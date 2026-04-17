import { Link } from "react-router-dom";
import { Search, MessageSquare, Phone, Mail, MapPin, ChevronRight, HelpCircle, FileQuestion, BookOpen, ShieldCheck, ArrowLeft } from "lucide-react";
import { cn } from "../lib/utils";

export default function Support() {
  return (
    <main className="relative mx-auto w-full max-w-7xl px-8 py-12">
      <Link 
        to="/" 
        className="relative z-10 mb-8 inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-all hover:-translate-x-1"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Quay lại trang chủ</span>
        <span className="opacity-40">/ 返回首页</span>
      </Link>

      {/* Background Decorative Grids */}
      <div className="grid-pattern pointer-events-none absolute left-0 top-0 h-full w-full opacity-[0.02]" />
      <div className="grid-pattern pointer-events-none absolute -right-20 top-20 h-80 w-80 opacity-10" />
      <div className="grid-pattern pointer-events-none absolute -left-20 bottom-20 h-96 w-96 opacity-10" />

      {/* Search Hero */}
      <div className="relative z-10 mb-24 flex flex-col items-center text-center">
        <h1 className="font-headline text-5xl font-black tracking-tighter text-on-surface md:text-7xl">
          Chúng tôi có thể giúp gì?<br />
          <span className="text-2xl font-bold opacity-60">我们可以如何帮助您？</span>
        </h1>
        
        <div className="mt-12 w-full max-w-2xl">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 h-6 w-6 -translate-y-1/2 text-on-surface-variant/40" />
            <input 
              type="text" 
              placeholder="Tìm kiếm hướng dẫn, câu hỏi... / 搜索指南、问题..."
              className="w-full rounded-2xl border-none bg-surface-container-low py-6 pl-16 pr-8 text-lg font-medium shadow-sm transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container"
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs font-bold text-on-surface-variant/60">
            <span>Gợi ý / 建议:</span>
            <button className="hover:text-primary transition-colors">Cách tính phí / 计费方式</button>
            <button className="hover:text-primary transition-colors">Thời gian vận chuyển / 运输时间</button>
            <button className="hover:text-primary transition-colors">Hàng cấm / 禁运物品</button>
          </div>
        </div>
      </div>

      {/* Contact Grid */}
      <div className="mb-24 grid grid-cols-1 gap-8 md:grid-cols-3">
        <ContactCard 
          icon={<MessageSquare className="h-6 w-6" />}
          title="Chat trực tuyến"
          subtitle="在线聊天"
          description="Hỗ trợ 24/7 từ đội ngũ chuyên gia của chúng tôi."
          action="Bắt đầu chat / 开始聊天"
          color="bg-primary/10 text-primary"
        />
        <ContactCard 
          icon={<Phone className="h-6 w-6" />}
          title="Hotline hỗ trợ"
          subtitle="服务热线"
          description="Gọi cho chúng tôi để được giải quyết nhanh nhất."
          action="1900 1234 (VN) / +86 123 456 (CN)"
          color="bg-secondary-container text-on-secondary-container"
        />
        <ContactCard 
          icon={<Mail className="h-6 w-6" />}
          title="Gửi Email"
          subtitle="发送邮件"
          description="Chúng tôi sẽ phản hồi trong vòng 2 giờ làm việc."
          action="support@precision.logistics"
          color="bg-surface-variant text-on-surface"
        />
      </div>

      {/* FAQs & Knowledge */}
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h2 className="mb-8 font-headline text-3xl font-black">Câu hỏi thường gặp / 常见问题</h2>
          <div className="space-y-4">
            <FaqItem 
              question="Làm thế nào để theo dõi đơn hàng Taobao?"
              cnQuestion="如何追踪淘宝订单？"
              answer="Bạn chỉ cần lấy mã vận đơn từ ứng dụng Taobao và nhập vào thanh tìm kiếm tại trang chủ của chúng tôi."
            />
            <FaqItem 
              question="Thời gian vận chuyển từ Đông Hưng về Hà Nội là bao lâu?"
              cnQuestion="从东兴到河内的运输时间是多少？"
              answer="Thông thường mất từ 3-5 ngày làm việc tùy thuộc vào loại hình vận chuyển và tình hình biên giới."
            />
            <FaqItem 
              question="Các mặt hàng nào bị cấm vận chuyển?"
              cnQuestion="哪些物品禁止运输？"
              answer="Chúng tôi tuân thủ nghiêm ngặt quy định của cả hai nước. Các mặt hàng cháy nổ, chất lỏng, thực phẩm tươi sống... thường bị hạn chế."
            />
          </div>
        </div>

        <div className="lg:col-span-5">
          <h2 className="mb-8 font-headline text-3xl font-black">Văn phòng / 办公地点</h2>
          <div className="space-y-6">
            <OfficeItem 
              city="Đông Hưng / 东兴"
              address="No. 123 Logistics Park, Dongxing City, China"
              type="Trung tâm tổng kho / 总仓中心"
            />
            <OfficeItem 
              city="Hà Nội / 河内"
              address="Số 456 Đường Giải Phóng, Quận Thanh Xuân, Hà Nội, Việt Nam"
              type="Trụ sở chính / 总部"
            />
            <OfficeItem 
              city="TP. Hồ Chí Minh / 胡志明市"
              address="Số 789 Đường Cộng Hòa, Quận Tân Bình, TP. HCM, Việt Nam"
              type="Chi nhánh miền Nam / 南部分公司"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function ContactCard({ icon, title, subtitle, description, action, color }: any) {
  return (
    <div className="group flex flex-col gap-6 rounded-3xl bg-surface-container-low p-10 transition-all hover:bg-surface-container hover:shadow-editorial">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", color)}>
        {icon}
      </div>
      <div>
        <h3 className="font-headline text-xl font-bold text-on-surface">{title}</h3>
        <p className="text-sm font-semibold opacity-60">{subtitle}</p>
      </div>
      <p className="text-sm leading-relaxed text-on-surface-variant">{description}</p>
      <button className="mt-4 flex items-center gap-2 text-sm font-bold text-primary group-hover:underline underline-offset-4">
        {action}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function FaqItem({ question, cnQuestion, answer }: any) {
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm transition-all hover:shadow-md">
      <div className="mb-2 flex items-center gap-3">
        <HelpCircle className="h-5 w-5 text-primary" />
        <div>
          <p className="font-bold text-on-surface">{question}</p>
          <p className="text-[10px] font-bold uppercase tracking-tight opacity-40">{cnQuestion}</p>
        </div>
      </div>
      <p className="ml-8 text-sm leading-relaxed text-on-surface-variant">{answer}</p>
    </div>
  );
}

function OfficeItem({ city, address, type }: any) {
  return (
    <div className="flex gap-4 rounded-2xl border border-surface-container p-6 transition-colors hover:bg-surface-container-low">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        <MapPin className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="font-bold text-on-surface">{city}</p>
          <span className="rounded bg-surface-container-highest px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter opacity-70">{type}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{address}</p>
      </div>
    </div>
  );
}
