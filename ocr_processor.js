#!/usr/bin/env node
/**
 * Standalone OCR processor for pay statements
 * Run this from command line to process files without the web interface
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node ocr_processor.js <file_path> [target_month]

Examples:
  node ocr_processor.js paycheck.pdf
  node ocr_processor.js paycheck.pdf 2026-01
  node ocr_processor.js "C:\\path\\to\\paycheck.pdf" 2026-01

The output will be JSON that you can save to a file and import into the web app.
    `);
    process.exit(1);
  }

  const filePath = args[0];
  const targetMonth = args[1] || new Date().toISOString().slice(0, 7); // YYYY-MM format

  try {
    const results = await processFile(filePath, targetMonth);
    console.log('\n✅ OCR Processing Complete!');
    console.log('📄 Results:');
    console.log(JSON.stringify(results, null, 2));

    // Also save to a file
    const outputFile = `ocr_results_${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results also saved to: ${outputFile}`);
    console.log('\n📋 To import into the web app:');
    console.log('1. Open the paycheck calculator');
    console.log('2. Copy the JSON above');
    console.log('3. The app will automatically import the data');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}