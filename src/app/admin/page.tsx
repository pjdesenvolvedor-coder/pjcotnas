
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AdminDashboardPage() {
    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl md:text-4xl font-bold font-headline text-primary">
                Painel do Administrador
                </h1>
                <p className="mt-2 text-base md:text-lg text-muted-foreground">
                Bem-vindo! Use o menu à esquerda para gerenciar o marketplace.
                </p>
            </header>
            <Card>
                <CardHeader>
                    <CardTitle>Visão Geral</CardTitle>
                    <CardDescription>
                        Esta é a área central para configurar e monitorar sua plataforma.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Selecione uma opção no menu para começar.</p>
                </CardContent>
            </Card>
        </div>
    );
}
