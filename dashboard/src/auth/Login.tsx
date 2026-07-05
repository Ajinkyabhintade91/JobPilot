import { useState } from 'react'
import { Alert, Button, Card, Center, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
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
            <div>
              <Group gap={10}>
                {/* brand mark — matches the app header */}
                <span
                  aria-hidden
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: 'var(--jp-primary)',
                    display: 'inline-block',
                  }}
                />
                <Title order={3}>JobPilot</Title>
              </Group>
              <Text size="sm" c="dimmed" mt={4}>
                Your overnight job pipeline.
              </Text>
            </div>
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
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
