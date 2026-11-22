/**
 * The arena's entry file: installs the scorecard's harness and mounts the gallery.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Gallery } from './gallery.tsx'
import { installHarness } from './harness.ts'
import './tokens.css'
import './gallery.css'

installHarness()
const root = document.getElementById('root')
if (root === null) throw new Error('index.html has no #root')
createRoot(root).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
)
