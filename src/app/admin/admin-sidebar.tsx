
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import {
  Shield,
  Users,
  LogOut,
  Ticket,
  Settings,
  MessageSquare,
  ShoppingBag,
  Gift,
} from 'lucide-react';

export function AdminSidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  
  const menuItems = [
    { href: '/admin', label: 'Painel', icon: Shield },
    { href: '/admin/services', label: 'Serviços', icon: ShoppingBag },
    { href: '/admin/users', label: 'Usuários', icon: Users },
    { href: '/admin/coupons', label: 'Cupons', icon: Ticket },
    { href: '/admin/special-coupons', label: 'Cupons Especiais', icon: Gift },
    { href: '/admin/payments', label: 'Pagamentos', icon: Settings },
    { href: '/admin/whatsapp', label: 'WhatsApp Conexão', icon: MessageSquare },
    { href: '/admin/whatsapp-messages', label: 'WhatsApp Mensagens', icon: MessageSquare },
  ];

  return (
    <aside className="hidden md:flex w-72 flex-shrink-0 bg-card border-r p-4 flex-col">
      <div className="mb-4 px-3">
         <p className="text-sm text-muted-foreground">Admin</p>
      </div>
      <nav className="flex-grow">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
            Gerenciamento
        </h3>
        <ul>
          {menuItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-secondary text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto">
        <Button
          onClick={() => signOut(auth)}
          variant="ghost"
          className="flex w-full justify-start items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </Button>
      </div>
    </aside>
  );
}
