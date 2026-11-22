[![make.fun](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/exc-ana/tiny-stack-vm-01/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/exc-ana/tiny-stack-vm-01/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

# Tiny stack VM — make.fun, 22 Nov 2026

Entry for "Build a tiny stack virtual machine" ($100, closes Wed 25 Nov 2026 11:00 WIB).
`main.ts` (Node 22, no install) runs every `program.bin` in `/input` on its
`input.bin` and writes `/output/<id>/stdout.bin` + `exit.txt`.

Local run: `MAKEFUN_INPUT_DIR=<kit>/practice/input MAKEFUN_OUTPUT_DIR=out node main.ts`

Practice: 40/40 byte-exact vs the reference VM, score 1,000,000 (house baseline 670,000).
Repo: main.ts 5,790 + LICENSE 1,095 + README.md 970 = 7,855 bytes (limit 8,192).
