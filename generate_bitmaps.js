import sharp from 'sharp';
import path from 'path';

const BUILD_DIR = 'c:/Users/fysg5/OneDrive/Escritorio/Pulse Hub/SofLIA - Hub/SofLIA-HUB/build/installer';
const SRC_DIR = path.join(BUILD_DIR, 'sources');
const BG_COLOR = '#12151a'; // Premium dark background

async function generateBitmaps() {
  try {
    // Generate Header (Standard NSIS: 150x57)
    // We'll place the logo and fill background
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

    // Generate Sidebar (Standard NSIS: 164x314)
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

    console.log('Bitmaps regenerated successfully.');
  } catch (err) {
    console.error('Error generating bitmaps:', err);
  }
}

generateBitmaps();
