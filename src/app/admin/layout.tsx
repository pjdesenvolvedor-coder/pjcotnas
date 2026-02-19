
'use client';

import { AdminSidebar } from './admin-sidebar';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import type { UserProfile } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);

  const { data: userData, isLoading: isUserDataLoading } =
    useDoc<UserProfile>(userDocRef);

  const isLoading = isUserLoading || isUserDataLoading;

  useEffect(() => {
    if (!isLoading) {
      if (!user || userData?.role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [isLoading, user, userData, router]);


  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userData?.role === 'admin') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] bg-background text-foreground">
        <AdminSidebar />
        <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-auto">
          {children}
        </main>
      </div>
    );
  }

  // Render a blank page or a redirecting message while redirecting
  return (
    <div className="flex h-screen w-full items-center justify-center">
        <p>Acesso negado. Redirecionando...</p>
    </div>
  );
}
