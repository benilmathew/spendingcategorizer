#!/usr/bin/env node
/**
 * Standalone OCR processor for pay statements
 * Run this from command line to process files without the web interface
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

function processFile(filePath, targetMonth) {
  return new Promise((resolve, reject) => {
    console.log(`Processing ${filePath}...`);

    const pythonProcess = spawn('python', ['paycheck_ocr.py', filePath, targetMonth], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`OCR processing failed: ${stderr}`));
        return;
      }

      try {
        const results = JSON.parse(stdout);
        resolve(results);
      } catch (parseError) {
        reject(new Error(`Failed to parse OCR results: ${parseError}`));
      }
    });

    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start OCR process: ${err.message}`));
    });
  });
}

async function processMonthFolder(monthName) {
  const payFolder = `${monthName}_Pay`;
  const outputFolder = `${monthName}OCR`;

  console.log(`🔍 Looking for pay statements in: ${payFolder}`);

  if (!fs.existsSync(payFolder)) {
    console.error(`❌ Error: Folder '${payFolder}' not found!`);
    console.log(`💡 Make sure you have a '${payFolder}' folder with your pay statement files.`);
    process.exit(1);
  }

  // Get all files in the pay folder
  const files = fs.readdirSync(payFolder)
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.pdf' || ext === '.png' || ext === '.jpg' || ext === '.jpeg';
    })
    .map(file => path.join(payFolder, file));

  if (files.length === 0) {
    console.error(`❌ Error: No PDF or image files found in '${payFolder}'!`);
    process.exit(1);
  }

  console.log(`📄 Found ${files.length} file(s) to process:`);
  files.forEach(file => console.log(`   - ${path.basename(file)}`));

  // Create output folder
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
    console.log(`📁 Created output folder: ${outputFolder}`);
  }

  const targetMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  let processedCount = 0;
  let successCount = 0;

  console.log(`\n🚀 Starting batch processing...\n`);

  for (const filePath of files) {
    const fileName = path.basename(filePath, path.extname(filePath));
    console.log(`📝 Processing: ${fileName}`);

    try {
      const results = await processFile(filePath, targetMonth);

      // Save to output folder
      const outputFileName = `ocr_${fileName}.json`;
      const outputPath = path.join(outputFolder, outputFileName);
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

      console.log(`   ✅ Saved to: ${outputPath}`);
      successCount++;

    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
    }

    processedCount++;
    console.log(`   Progress: ${processedCount}/${files.length}\n`);
  }

  console.log(`\n🎉 Batch processing complete!`);
  console.log(`📊 Results: ${successCount}/${files.length} files processed successfully`);
  console.log(`📁 Output folder: ${outputFolder}`);
  console.log(`🤖 You can now import all files from ${outputFolder} in the web app`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node ocr_processor.js <file_path> [month_folder]
       node ocr_processor.js <month>  (processes all files in {month}_Pay folder)

Examples:
  node ocr_processor.js paycheck.pdf
  node ocr_processor.js paycheck.pdf Jan
  node ocr_processor.js Jan  (processes all files in Jan_Pay/)
  node ocr_processor.js Feb  (processes all files in Feb_Pay/)
  node ocr_processor.js "C:\\path\\to\\paycheck.pdf" Mar

The output will be JSON that you can save to a file and import into the web app.
If a month folder is specified (e.g., 'Jan'), files will be saved in a '{Month}OCR' folder.
    `);
    process.exit(1);
  }

  const firstArg = args[0];

  // Check if first argument is a month name (3+ letters, starts with capital, no file extensions)
  const isMonthName = /^[A-Z][a-z]{2,}$/.test(firstArg) && !firstArg.includes('.') && !firstArg.includes('/') && !firstArg.includes('\\');

  if (isMonthName) {
    // Process entire month folder
    await processMonthFolder(firstArg);
  } else {
    // Process single file
    const filePath = firstArg;
    const monthFolder = args[1]; // Optional month folder parameter
    const targetMonth = monthFolder ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` : new Date().toISOString().slice(0, 7); // YYYY-MM format

    try {
      const results = await processFile(filePath, targetMonth);
      console.log('\n✅ OCR Processing Complete!');
      console.log('📄 Results:');
      console.log(JSON.stringify(results, null, 2));

      // Create folder and save file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = path.basename(filePath, path.extname(filePath));

      let outputDir = '.';
      let outputFileName = `ocr_${fileName}_${timestamp}.json`;

      if (monthFolder) {
        outputDir = `${monthFolder}OCR`;
        outputFileName = `ocr_${fileName}.json`; // Simpler name in month folders

        // Create directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
          console.log(`📁 Created folder: ${outputDir}`);
        }
      }

      const autoImportFile = path.join(outputDir, outputFileName);
      fs.writeFileSync(autoImportFile, JSON.stringify(results, null, 2));
      console.log(`\n💾 OCR data saved to: ${autoImportFile}`);
      console.log('🤖 Click "Import OCR Files" in the web app to load this data');

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

// Run main function
main();