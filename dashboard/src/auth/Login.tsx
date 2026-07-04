import { useState } from 'react'
import { Alert, Button, Card, Center, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <Center h="100vh" p="md">
      <Card withBorder w={380} p="lg">
        <form onSubmit={signIn}>
          <Stack>
            <Title order={3}>JobPilot</Title>
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
            {error && <Alert color="red">{error}</Alert>}
            <Button type="submit" loading={loading}>
              Sign in
            </Button>
          </Stack>
        </form>
      </Card>
    </Center>
  )
}
