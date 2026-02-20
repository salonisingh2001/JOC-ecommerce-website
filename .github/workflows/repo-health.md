---
on:
  push: {}
  workflow_dispatch: {}

permissions:
  contents: read
  issues: read
  pull-requests: read

engine: copilot

safe-outputs:
  create-issue:
    title-prefix: "[AI-Report] "
---
# Repository Health Report Agent

You are a repository assistant.

## Task 1: Basic Health Check
Identify all open pull requests and list the names of all branches. 

## Final Action
Create a new GitHub Issue with these findings using the safe-outputs tool.