#!/bin/bash
cd /home/kavia/workspace/code-generation/galactic-defender-87118-87285/spaceship_game_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

