import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const stack = ['Electron', 'React', 'TypeScript', 'Tailwind', 'shadcn/ui']

export function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Gestion Produits Desktop</h2>
        <p className="text-muted-foreground">Application Desktop Local First</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Socle technique</CardTitle>
          <CardDescription>État de la fondation frontend</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {stack.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
          <Button className="w-fit">Commencer</Button>
        </CardContent>
      </Card>
    </div>
  )
}
