
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { doc } from 'firebase/firestore';
import {
  Store,
  CreditCard,
  LogOut,
  Bell,
  LifeBuoy,
  PackageCheck,
  Percent,
  Shield,
  Users,
  Ticket,
  Settings,
  MessageSquare,
  ShoppingBag,
  Gift,
} from 'lucide-react';

export function SellerSidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<UserProfile>(userDocRef);

  const sellerMenuItems = [
    {
      group: 'MENU VENDEDOR',
      items: [
        { href: '/seller', label: 'Meus anúncios', icon: Store },
        { href: '#', label: 'Minhas vendas', icon: CreditCard, disabled: true },
        { href: '/seller/tickets', label: 'Tickets', icon: LifeBuoy, disabled: false },
        { href: '/seller/taxas', label: 'Taxas', icon: Percent, disabled: false },
      ],
    },
    {
      group: 'MENU CLIENTE',
      items: [
        { href: '/seller/compras', label: 'Minhas compras', icon: PackageCheck },
        { href: '#', label: 'Notificações', icon: Bell, disabled: true },
      ],
    },
  ];
  
  const adminMenuItems = [
    { href: '/seller/dashboard', label: 'Painel Admin', icon: Shield },
    { href: '/seller/services', label: 'Serviços', icon: ShoppingBag },
    { href: '/seller/users', label: 'Usuários', icon: Users },
    { href: '/seller/coupons', label: 'Cupons', icon: Ticket },
    { href: '/seller/special-coupons', label: 'Cupons Especiais', icon: Gift },
    { href: '/seller/payments', label: 'Pagamentos', icon: Settings },
    { href: '/seller/whatsapp', label: 'WhatsApp Conexão', icon: MessageSquare },
    { href: '/seller/whatsapp-messages', label: 'WhatsApp Mensagens', icon: MessageSquare },
  ];

  const isAdmin = !isUserLoading && !isUserDataLoading && userData?.role === 'admin';

  return (
    <aside className="hidden md:flex w-72 flex-shrink-0 bg-card border-r p-4 flex-col">
      <div className="mb-4 px-3">
         <p className="text-sm text-muted-foreground">Painel do Vendedor</p>
      </div>
      <nav className="flex-grow">
        {isAdmin && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
              ADMINISTRAÇÃO
            </h3>
            <ul>
              {adminMenuItems.map((item) => (
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
          </div>
        )}

        {sellerMenuItems.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
              {group.group}
            </h3>
            <ul>
              {group.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      pathname === item.href && !item.disabled
                        ? 'bg-secondary text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                      item.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    aria-disabled={item.disabled}
                    onClick={(e) => item.disabled && e.preventDefault()}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

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
