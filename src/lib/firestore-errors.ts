import { auth } from "./firebase";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Detect common error types
  const isApiKeyError = errorMessage.includes("API key not valid") || errorMessage.includes("invalid-api-key");
  const isPermissionError = errorMessage.includes("permission-denied") || errorMessage.includes("insufficient permissions");
  const isQuotaError = errorMessage.includes("quota-exceeded");

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }

  // Enhanced logging for debugging
  if (isApiKeyError) {
    console.error('CRITICAL: Firebase API Key is invalid or missing. Check .env or firebase-applet-config.json');
    console.warn('HƯỚNG DẪN: Vui lòng kiểm tra API Key trong cấu hình Firebase. Nếu bạn vừa đổi Project, hãy cập nhật lại file config.');
  } else if (isPermissionError) {
    console.error(`PERMISSION DENIED: User ${auth.currentUser?.email || 'Anonymous'} cannot ${operationType} at ${path}. Check firestore.rules.`);
    console.warn('HƯỚNG DẪN: Lỗi phân quyền. Đảm bảo bạn đã đăng nhập với quyền Admin hoặc Rules đã cho phép truy cập đường dẫn này.');
  } else if (isQuotaError) {
    console.error('QUOTA EXCEEDED: Firestore free tier limit reached.');
    console.warn('HƯỚNG DẪN: Bạn đã dùng hết hạn mức miễn phí của Firestore. Vui lòng đợi đến ngày mai hoặc nâng cấp gói cước.');
  } else {
    console.error(`DATABASE ERROR: Lỗi không xác định khi thực hiện ${operationType} tại ${path}.`);
  }

  console.error('Firestore Error Details: ', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}
