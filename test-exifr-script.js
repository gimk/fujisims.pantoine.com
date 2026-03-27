import { parse } from 'exifr';
import path from 'path';

async function test() {
  const p1 = '/Users/antoinepouligny/Documents/Projects/Websites/fujisims.pantoine.com/src/assets/recipes/new-american/1.jpg';
  try {
    const res = await parse(p1);
    console.log('Test EXIF worked!', !!res);
  } catch (e) {
    console.error('Test EXIF failed!', e);
  }
}
test();
