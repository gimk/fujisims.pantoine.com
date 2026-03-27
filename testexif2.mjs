import fs from 'fs';
import exifr from 'exifr';
import path from 'path';

(async () => {
  const filePath = path.join(process.cwd(), 'src/assets/recipes/new-american/1.jpg');
  try {
    const exif = await exifr.parse(filePath, { tiff: true, exif: true });
    console.log('EXIF for 1.jpg:', exif ? 'FOUND' : 'NULL');
  } catch (e) {
    console.log('ERROR:', e.message);
  }
})();
