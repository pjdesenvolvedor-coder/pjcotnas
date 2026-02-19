
'use client';
import { useUser, useFirestore, useMemoFirebase, useCollection, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile as UserProfileType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export default function UserManagementPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const usersRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading } = useCollection<UserProfileType>(usersRef);

  const [isUserDeleteDialogOpen, setIsUserDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfileType | null>(null);

  const handleToggleAdmin = (userToUpdate: UserProfileType) => {
    if (!firestore || !userToUpdate) return;
    
    if (currentUser?.uid === userToUpdate.id) {
        toast({ variant: "destructive", title: "Ação não permitida", description: "Você não pode alterar sua própria função." });
        return;
    }

    const adminCount = users?.filter(u => u.role === 'admin').length || 0;
    if (userToUpdate.role === 'admin' && adminCount <= 1) {
        toast({ variant: "destructive", title: "Ação não permitida", description: "Não é possível remover o único administrador do sistema." });
        return;
    }

    const userRef = doc(firestore, 'users', userToUpdate.id);
    const newRole = userToUpdate.role === 'admin' ? 'customer' : 'admin';

    updateDocumentNonBlocking(userRef, { role: newRole });
    toast({
      title: "Função do Usuário Atualizada!",
      description: `${userToUpdate.firstName} agora é ${newRole === 'admin' ? 'administrador(a)' : 'cliente'}.`
    });
  };

  const handleDeleteUserRequest = (userToDelete: UserProfileType) => {
    if (currentUser?.uid === userToDelete.id) {
        toast({ variant: "destructive", title: "Ação não permitida", description: "Você não pode apagar sua própria conta." });
        return;
    }
    setSelectedUser(userToDelete);
    setIsUserDeleteDialogOpen(true);
  };

  const handleConfirmUserDelete = () => {
    if (!selectedUser || !firestore) return;

    const userRef = doc(firestore, 'users', selectedUser.id);
    deleteDocumentNonBlocking(userRef);

    toast({
      title: "Usuário Apagado!",
      description: "O registro do usuário foi removido do sistema."
    });
    
    setIsUserDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  return (
    <>
      <AlertDialog open={isUserDeleteDialogOpen} onOpenChange={setIsUserDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá apagar permanentemente o registro de usuário, mas a conta de autenticação permanecerá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedUser(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUserDelete} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Usuários</CardTitle>
          <CardDescription>Visualize e gerencie todos os usuários do sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : users && users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Data de Registro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.firstName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={
                        user.role === 'admin' ? 'destructive' :
                        user.role === 'seller' ? 'secondary' : 'outline'
                      }>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.registrationDate).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleToggleAdmin(user)}>
                            {user.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteUserRequest(user)}
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            Apagar usuário
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">Nenhum usuário encontrado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
