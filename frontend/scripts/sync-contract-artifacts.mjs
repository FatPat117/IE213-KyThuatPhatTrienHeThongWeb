import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');

const sourceRoots = [
  path.join(repoRoot, 'smart-contracts'),
  path.join(frontendRoot, '..', 'smart-contracts'),
  path.join(frontendRoot, 'smart-contracts'),
  '/smart-contracts',
];

const artifactsDir = path.join(frontendRoot, 'src', 'lib', 'contracts', 'artifacts');
const abiTarget = path.join(artifactsDir, 'FundingPlatform.abi.json');
const deploymentTarget = path.join(artifactsDir, 'sepolia-latest.json');

function resolveSourcePaths() {
  for (const root of sourceRoots) {
    const abiSource = path.join(root, 'shared', 'abi', 'FundingPlatform.abi.json');
    const deploymentSource = path.join(root, 'deployments', 'sepolia-latest.json');
    if (fs.existsSync(abiSource) && fs.existsSync(deploymentSource)) {
      return { abiSource, deploymentSource };
    }
  }
  return null;
}

function syncContractArtifacts() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const resolvedSources = resolveSourcePaths();

  if (resolvedSources) {
    fs.copyFileSync(resolvedSources.abiSource, abiTarget);
    fs.copyFileSync(resolvedSources.deploymentSource, deploymentTarget);
    console.log('[sync-contract-artifacts] Synced from smart-contracts:');
    console.log(`- ${resolvedSources.abiSource}`);
    console.log(`- ${resolvedSources.deploymentSource}`);
    return;
  }

  // Container fallback: if smart-contracts is not mounted, keep existing local artifacts.
  if (fs.existsSync(abiTarget) && fs.existsSync(deploymentTarget)) {
    console.warn('[sync-contract-artifacts] smart-contracts not found; using existing local artifacts.');
    return;
  }

  throw new Error(
    `Missing required contract artifact sources. Checked: ${sourceRoots.join(', ')}`
  );
}

syncContractArtifacts();
