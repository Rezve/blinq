import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })

run('npm version patch --no-git-tag-version')
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
run('git add package.json package-lock.json')
run(`git commit -m "Bump version to ${version}"`)
