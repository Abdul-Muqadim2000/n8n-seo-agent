#!/bin/sh
# usage: run.sh script.mts
S=/private/tmp/claude-502/-Users-abdul-muqadim-alaventra/684b9b8c-1bd6-4faf-9505-1a36ad680f8c/scratchpad/ux
docker run --rm --ipc=host -v $S/app:/app -v kirev_ux_nm:/app/node_modules -v $S/pw:/pw -v $S/out:/out -w /pw mcr.microsoft.com/playwright:v1.55.0-noble node --import /app/node_modules/tsx/dist/esm/index.mjs /pw/$1
