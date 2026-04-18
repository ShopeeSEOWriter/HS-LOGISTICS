import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-surface-container bg-surface-container-low py-12 px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-12 md:flex-row">
          <div className="flex flex-col gap-4">
            <span className="font-headline text-xl font-black uppercase tracking-tighter text-primary">
              HS Logistics
            </span>
            <p className="max-w-xs text-xs leading-relaxed text-on-surface-variant">
              和晟越南货运 - Hệ thống vận chuyển hàng hoá từ Trung Quốc về Việt Nam với 12 năm kinh nghiệm.
              <br />
              <span className="mt-1 block opacity-70">拥有12年从中国到越南的货物运输经验的领先系统。</span>
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-12 md:grid-cols-3">
            <FooterSection title="Trung tâm / 枢纽">
              <FooterLink href="#">Kho Đông Hưng / 东兴仓库</FooterLink>
              <FooterLink href="#">Trung tâm Hà Nội / 河内中心</FooterLink>
              <FooterLink href="#">Kho Sài Gòn / 西贡仓库</FooterLink>
            </FooterSection>
            <FooterSection title="Hỗ trợ / 帮助">
              <Link to="/support" className="text-xs text-on-surface-variant underline-offset-4 hover:text-primary hover:underline transition-colors">Liên hệ / 联系我们</Link>
              <FooterLink href="tel:0869863853">Hotline: 0869863853</FooterLink>
              <FooterLink href="mailto:hslogicticsvietnam@gmail.com">hslogicticsvietnam@gmail.com</FooterLink>
            </FooterSection>
            <FooterSection title="Pháp lý / 法律">
              <FooterLink href="#">Bảo mật / 隐私政策</FooterLink>
              <FooterLink href="#">Điều khoản / 服务条款</FooterLink>
            </FooterSection>
          </div>
        </div>
        
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-surface-container pt-8 md:flex-row">
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant opacity-80">
            © 2024 HS Logistics. 和晟越南货运.
          </span>
          <div className="flex items-center gap-4 text-[10px] font-bold text-on-surface-variant">
            <span>English (Global) / Vietnamese / 中文</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">{title}</span>
      {children}
    </div>
  );
}

function FooterLink({ href, children }: { href: string, children: React.ReactNode }) {
  return (
    <a href={href} className="text-xs text-on-surface-variant underline-offset-4 hover:text-primary hover:underline transition-colors">
      {children}
    </a>
  );
}
