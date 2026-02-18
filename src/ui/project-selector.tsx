import * as React from 'react'
import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { FolderOpen, Plus, Trash2, Pencil, ArrowRight } from 'lucide-react'

export function ProjectSelector() {
  const { projects, projectData, addProject, renameProject, deleteProject, setActiveProject } = useValuationStore()
  const [newName, setNewName] = React.useState('')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingName, setEditingName] = React.useState('')

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    addProject(name)
    setNewName('')
  }

  const handleRename = (id: string) => {
    const name = editingName.trim()
    if (!name) return
    renameProject(id, name)
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este projeto? Todos os dados serão perdidos.')) return
    deleteProject(id)
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary">Valuation DCF</h1>
          <p className="text-muted-foreground">Selecione um projeto existente ou crie um novo para começar.</p>
        </div>

        {/* Criar novo projeto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <Plus className="h-5 w-5 inline mr-2" />
              Novo Projeto
            </CardTitle>
            <CardDescription>
              Dê um nome ao projeto para identificá-lo (ex: nome da empresa).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreate() }}
              className="flex gap-3"
            >
              <Input
                placeholder="Nome do projeto..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={!newName.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Criar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de projetos */}
        {projects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                <FolderOpen className="h-5 w-5 inline mr-2" />
                Projetos ({projects.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.map((project) => {
                const pd = projectData[project.id]
                const scenarioCount = pd?.scenarios.length ?? 0

                return (
                  <div
                    key={project.id}
                    className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                  >
                    <FolderOpen className="h-5 w-5 text-primary shrink-0" />

                    <div className="flex-1 min-w-0">
                      {editingId === project.id ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); handleRename(project.id) }}
                          className="flex gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8"
                            onBlur={() => handleRename(project.id)}
                          />
                        </form>
                      ) : (
                        <>
                          <p className="font-medium truncate">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {scenarioCount} cenário{scenarioCount !== 1 ? 's' : ''}
                            {' · '}
                            Criado em {new Date(project.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(project.id)
                          setEditingName(project.name)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(project.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setActiveProject(project.id)}
                    >
                      Abrir
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
