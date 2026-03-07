import sharp from 'sharp';
import path from 'path';

async function checkImages() {
  const headerPath = 'c:/Users/fysg5/OneDrive/Escritorio/Pulse Hub/SofLIA - Hub/SofLIA-HUB/build/installer/installerHeader.bmp';
  const sidebarPath = 'c:/Users/fysg5/OneDrive/Escritorio/Pulse Hub/SofLIA - Hub/SofLIA-HUB/build/installer/installerSidebar.bmp';

  try {
    const headerMetadata = await sharp(headerPath).metadata();
    const sidebarMetadata = await sharp(sidebarPath).metadata();
    console.log('Header:', headerMetadata.width, 'x', headerMetadata.height);
    console.log('Sidebar:', sidebarMetadata.width, 'x', sidebarMetadata.height);
  } catch (err) {
    console.error(err);
  }
}

checkImages();
