import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to project root
const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build', 'installer');
const SRC_DIR = path.join(BUILD_DIR, 'sources');
const BG_COLOR = '#12151a'; // Premium dark background (Match with installer.nsh)

async function generateBitmaps() {
  console.log('Regenerating installer bitmaps...');
  try {
    // Generate Header (NSIS: 150x57)
    await sharp(path.join(SRC_DIR, 'header.png'))
      .resize({
        width: 150,
        height: 57,
        fit: 'contain',
        background: BG_COLOR
      })
      .toFormat('bmp')
      .toFile(path.join(BUILD_DIR, 'installerHeader.bmp'));
    
    await sharp(path.join(SRC_DIR, 'header.png'))
      .resize({
        width: 150,
        height: 57,
        fit: 'contain',
        background: BG_COLOR
      })
      .toFormat('bmp')
      .toFile(path.join(BUILD_DIR, 'uninstallerHeader.bmp'));

    // Generate Sidebar (NSIS: 164x314)
    await sharp(path.join(SRC_DIR, 'sidebar.png'))
      .resize({
        width: 164,
        height: 314,
        fit: 'cover',
        position: 'center'
      })
      .toFormat('bmp')
      .toFile(path.join(BUILD_DIR, 'installerSidebar.bmp'));

    await sharp(path.join(SRC_DIR, 'uninstaller-sidebar.png'))
      .resize({
        width: 164,
        height: 314,
        fit: 'cover',
        position: 'center'
      })
      .toFormat('bmp')
      .toFile(path.join(BUILD_DIR, 'uninstallerSidebar.bmp'));

    console.log('✓ Bitmaps regenerated successfully.');
  } catch (err) {
    console.error('Error generating bitmaps:', err);
    process.exit(1);
  }
}

generateBitmaps();
