
'use client';

import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { SubscriptionService } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';

const serviceSchema = z.object({
  name: z.string().min(2, "O nome é obrigatório."),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

function ServiceForm({
  onSave,
  onClose,
  service,
}: {
  onSave: (data: ServiceFormData) => void;
  onClose: () => void;
  service?: SubscriptionService | null;
}) {
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name || '',
    },
  });

  const { formState } = form;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Serviço</FormLabel>
              <FormControl><Input placeholder="Ex: Netflix" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={formState.isSubmitting}>
                {formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Serviço
            </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function ServiceManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<SubscriptionService | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);

  const servicesRef = useMemoFirebase(() => collection(firestore, 'services'), [firestore]);
  const { data: services, isLoading } = useCollection<SubscriptionService>(servicesRef);

  const handleAddNew = () => {
    setEditingService(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (service: SubscriptionService) => {
    setEditingService(service);
    setIsDialogOpen(true);
  };

  const handleDeleteRequest = (serviceId: string) => {
    setDeletingServiceId(serviceId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingServiceId) return;
    
    const serviceRef = doc(firestore, 'services', deletingServiceId);
    deleteDocumentNonBlocking(serviceRef);

    toast({
        title: "Serviço apagado!",
        description: "O serviço de streaming foi removido.",
    });

    setIsDeleteDialogOpen(false);
    setDeletingServiceId(null);
  };
  
  const handleSave = (values: ServiceFormData) => {
    if (editingService) {
      // Update only the name
      const serviceRef = doc(firestore, 'services', editingService.id);
      setDocumentNonBlocking(serviceRef, values, { merge: true });
      toast({
        title: 'Serviço Atualizado!',
        description: 'As alterações foram salvas.',
      });
    } else {
      // Create new service with placeholder data for other fields
      const newServiceRef = doc(collection(firestore, 'services'));
      const newServiceData = { 
        ...values, // just 'name'
        id: newServiceRef.id,
        description: `Descrição para ${values.name}`,
        longDescription: `Descrição longa e detalhada para ${values.name}`,
        logoUrl: `https://placehold.co/200x100/cccccc/FFFFFF/png?text=${encodeURIComponent(values.name)}`,
        imageHint: 'logo',
        bannerUrl: `https://placehold.co/600x300/cccccc/FFFFFF/png?text=${encodeURIComponent(values.name)}`,
        bannerHint: 'banner'
      };
      setDocumentNonBlocking(newServiceRef, newServiceData, { merge: false });
      toast({
        title: 'Serviço Criado!',
        description: 'O novo serviço de streaming está disponível.',
      });
    }
    
    setIsDialogOpen(false);
    setEditingService(null);
  };

  return (
    <>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá apagar permanentemente o serviço.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingServiceId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingService(null); setIsDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Editar Serviço' : 'Adicionar Novo Serviço'}</DialogTitle>
          </DialogHeader>
          <ServiceForm 
            onSave={handleSave} 
            onClose={() => setIsDialogOpen(false)} 
            service={editingService}
          />
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gerenciamento de Serviços de Streaming</CardTitle>
            <CardDescription>Adicione, edite ou remova os serviços disponíveis no seu marketplace.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleAddNew}>
              <PlusCircle className="mr-2" /> Adicionar Serviço
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : services && services.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(service)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRequest(service.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash className="h-4 w-4" />
                          <span className="sr-only">Apagar</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">Nenhum serviço cadastrado.</p>
              <p className="text-sm text-muted-foreground">Clique em "Adicionar Serviço" para começar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
