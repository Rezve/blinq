// Fills the GitHub release for the current package.json version with a changelog
// built from the commits since the previous release.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const token = process.env.GH_TOKEN
if (!token) throw new Error('GH_TOKEN is not set')

const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8' }).trim()
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const tag = `v${version}`

const remote = git('remote get-url origin')
const [, repo] = remote.match(/github\.com[:/](.+?)(?:\.git)?$/) ?? []
if (!repo) throw new Error(`Cannot parse GitHub repo from remote: ${remote}`)

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...init.headers }
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`)
  return res.json()
}

const parse = (t) => t.replace(/^v/, '').split('.').map(Number)
const isOlder = (a, b) => {
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]
  return false
}

const releases = await api('/releases?per_page=100')
const current = releases.find((r) => r.tag_name === tag)
if (!current) throw new Error(`No GitHub release found for ${tag}`)

const previous = releases
  .filter((r) => !r.draft && isOlder(r.tag_name, tag))
  .sort((a, b) => (isOlder(a.tag_name, b.tag_name) ? 1 : -1))[0]

// Base ref: the previous release's tag, else its "Bump version" commit.
let base = ''
if (previous) {
  const hasTag = git(`tag -l ${previous.tag_name}`)
  base = hasTag
    ? previous.tag_name
    : git(`log --format=%H --fixed-strings --grep="Bump version to ${previous.tag_name.slice(1)}" -n 1`)
}

const log = git(`log ${base ? `${base}..HEAD` : 'HEAD'} --no-merges --format=%h%x09%s`)
const lines = log
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\t'))
  .filter(([, subject]) => !/^Bump version to /.test(subject))
  .map(([sha, subject]) => `- ${subject} (${sha})`)

const body = [
  `## What's changed`,
  lines.length ? lines.join('\n') : '- Maintenance release',
  previous ? `\n**Full changelog:** https://github.com/${repo}/compare/${previous.tag_name}...${tag}` : ''
].join('\n')

await api(`/releases/${current.id}`, { method: 'PATCH', body: JSON.stringify({ body }) })
console.log(`Updated release notes for ${tag}:\n${body}`)
