'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Menu, LogOut, Shield, ShoppingBag, Store, Home, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { signOut } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { doc } from 'firebase/firestore';
import { useEffect } from 'react';

export function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<{ role: string; lastSeen?: string }>(userDocRef);

  useEffect(() => {
    if (user && firestore) {
      const userRef = doc(firestore, 'users', user.uid);
      // Only update if last seen was more than a minute ago to avoid excessive writes
      const now = new Date();
      const lastSeenDate = userData?.lastSeen ? new Date(userData.lastSeen) : new Date(0);
      const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / 60000;
      
      if (diffMinutes > 1) {
          updateDocumentNonBlocking(userRef, {
            lastSeen: now.toISOString()
          });
      }
    }
  }, [user, firestore, userData]);

  const handleLogout = () => {
    signOut(auth);
  };

  const isLoading = isUserLoading || isUserDataLoading;

  const isAdmin = !isLoading && userData?.role === 'admin';
  const isSeller = !isLoading && (userData?.role === 'seller' || userData?.role === 'admin');

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="https://i.imgur.com/TMvl1WN.png" alt="PJ Contas Logo" width={32} height={32} />
          <span className="text-xl font-bold text-primary font-headline">
            PJ Contas
          </span>
        </Link>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Navegação principal do site</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col h-full">
               <div className="p-4 border-b">
                 <SheetClose asChild>
                   <Link href="/" className="flex items-center gap-2">
                    <Image src="https://i.imgur.com/TMvl1WN.png" alt="PJ Contas Logo" width={32} height={32} />
                    <span className="text-xl font-bold text-primary font-headline">
                      PJ Contas
                    </span>
                  </Link>
                 </SheetClose>
              </div>
              
              <nav className="flex-grow p-4 space-y-2">
                 <SheetClose asChild>
                  <Button variant="ghost" className="w-full justify-start text-base" asChild>
                    <Link href="/">
                      <Home className="mr-2"/> Home
                    </Link>
                  </Button>
                </SheetClose>

                {isUserLoading ? (
                  <div className="space-y-2 px-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : user ? (
                  <>
                    <SheetClose asChild>
                       <Button variant="ghost" className="w-full justify-start text-base" asChild>
                          <Link href="/dashboard">
                            <UserIcon className="mr-2" /> Minha Conta
                          </Link>
                       </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button variant="ghost" className="w-full justify-start text-base" asChild>
                          <Link href="/seller/compras">
                            <ShoppingBag className="mr-2" /> Minhas Compras
                          </Link>
                      </Button>
                    </SheetClose>
                    {isSeller && (
                      <SheetClose asChild>
                         <Button variant="ghost" className="w-full justify-start text-base" asChild>
                            <Link href="/seller">
                               <Store className="mr-2"/> Painel do Vendedor
                            </Link>
                         </Button>
                      </SheetClose>
                    )}
                  </>
                ) : null }
              </nav>

              <div className="p-4 mt-auto border-t">
                {isUserLoading ? (
                   <Skeleton className="h-10 w-full" />
                ) : user ? (
                  <SheetClose asChild>
                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-base">
                      <LogOut className="mr-2" /> Sair
                    </Button>
                  </SheetClose>
                ) : (
                   <SheetClose asChild>
                    <AuthDialog />
                   </SheetClose>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
