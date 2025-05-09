import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the current filename and directory path
const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);

// Resolve the root directory of the project
const rootDir: string = path.resolve(__dirname, '..');

// Read the content of the main README.md file
const readmeContent: string = fs.readFileSync(
  path.join(rootDir, 'README.md'),
  'utf-8',
);

// Define the initial list of target directories
const targetDirs: string[] = ['apps/vscode-extension'];

// Define the base path for the toolbar directories
const toolbarBasePath: string = path.join(rootDir, 'toolbar');

// Check if the toolbar directory exists
if (fs.existsSync(toolbarBasePath)) {
  // Read all subdirectories within the toolbar directory
  const toolbarSubDirs: string[] = fs
    .readdirSync(toolbarBasePath, { withFileTypes: true })
    // Filter out files, keeping only directories
    .filter((dirent: fs.Dirent) => dirent.isDirectory())
    // Map directory names to their relative paths
    .map((dirent: fs.Dirent) => path.join('toolbar', dirent.name));
  // Add the toolbar subdirectories to the list of target directories
  targetDirs.push(...toolbarSubDirs);
} else {
  // Log a warning if the toolbar directory is not found
  console.warn(`Warning: Directory not found: ${toolbarBasePath}`);
}

// Iterate over each target directory
targetDirs.forEach((relativeDir: string) => {
  // Construct the absolute path for the current target directory
  const targetPath: string = path.join(rootDir, relativeDir);
  // Check if the target directory exists, create it if it doesn't
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
    console.log(`Created directory: ${targetPath}`);
  }
  // Construct the path for the README.md file in the target directory
  const readmePath: string = path.join(targetPath, 'README.md');
  // Write the content of the main README.md to the target directory
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`Copied README.md to ${readmePath}`);
});

// Log a message indicating the completion of the process
console.log('README.md copying process complete.');
