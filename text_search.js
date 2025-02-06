#!/usr/bin/env node

/**
 * Text Search Counter
 * 
 * This script counts occurrences of multiple search term groups in text file(s) and outputs the results to a CSV file.
 * The script performs case-insensitive searches for each term and creates a new CSV file with a timestamp in
 * the filename.
 * 
 * IMPORTANT: For performance, this script is designed to perform searches on ALL-LOWERCASE text files only.
 * Search terms can be provided in any case.
 * 
 * Input:
 *     - A text file OR directory containing text files to search within
 *     - A file containing forward-slash-separated groups of search terms (one group per line)
 *       Each line represents an OR condition - it counts occurrences of ANY term in the group
 * 
 * Output:
 *     - A CSV file named 'search_results_YYYYMMDD_HHMMSS.csv' containing:
 *         * First column: Name of each input file
 *         * Additional columns: Count for each search term group in that file
 * 
 * Usage:
 *     node text_search.js path/to/text_file_or_directory path/to/search_terms.txt
 * 
 * Requirements:
 *     npm install fs-extra csv-stringify
 */

const fs = require('fs-extra');
const path = require('path');
const { stringify } = require('csv-stringify/sync');

async function countOccurrences(filepath, termGroups) {
    try {
        const content = await fs.readFile(filepath, 'utf8');
        const lowerContent = content.toLowerCase();
        
        const results = {};
        for (const [groupName, terms] of termGroups) {
            // Count occurrences of any term in the group (case-insensitive, whole words only)
            let totalCount = 0;
            for (const term of terms) {
                const pattern = new RegExp('\\b' + term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b[.,!?:;"\')\\]\\}]*', 'g');
                const matches = lowerContent.match(pattern);
                totalCount += matches ? matches.length : 0;
            }
            results[groupName] = totalCount;
        }
        
        return results;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Error: File not found at '${filepath}'`);
        } else {
            console.log(`Error reading file: ${error.message}`);
        }
        return null;
    }
}

async function readSearchTerms(termsFilepath) {
    try {
        const content = await fs.readFile(termsFilepath, 'utf8');
        // Read non-empty lines and split into groups
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => {
                const terms = line.split('/').map(term => term.trim());
                return [line, terms];
            });
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Error: Search terms file not found at '${termsFilepath}'`);
        } else {
            console.log(`Error reading search terms file: ${error.message}`);
        }
        return null;
    }
}

async function getFilesToProcess(inputPath) {
    try {
        const stats = await fs.stat(inputPath);
        if (stats.isFile()) {
            return [inputPath];
        } else if (stats.isDirectory()) {
            const files = await fs.readdir(inputPath);
            const filePaths = files
                .map(file => path.join(inputPath, file))
                .filter(async filepath => (await fs.stat(filepath)).isFile());
            return (await Promise.all(filePaths)).sort();
        }
        return [];
    } catch (error) {
        console.log(`Error accessing path: ${error.message}`);
        return [];
    }
}

async function writeResultsToCsv(fileResults, termGroups) {
    // Create data directory if it doesn't exist
    await fs.ensureDir('data');
    
    // Generate output filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').split('T').join('_').slice(0, 15);
    const outputFile = path.join('data', `search_results_${timestamp}.csv`);
    
    // Prepare CSV data
    const header = ['Filename', ...termGroups.map(([groupName]) => groupName)];
    const rows = fileResults.map(([filepath, results]) => {
        return [
            path.basename(filepath),
            ...termGroups.map(([groupName]) => results[groupName])
        ];
    });
    
    // Write to CSV
    const csvContent = stringify([header, ...rows]);
    await fs.writeFile(outputFile, csvContent, 'utf8');
    
    return outputFile;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 2) {
        console.log('Usage: node text_search.js <path_to_file_or_directory> <path_to_search_terms>');
        process.exit(1);
    }
    
    const [filepath, termsFile] = args;
    
    const termGroups = await readSearchTerms(termsFile);
    if (!termGroups) {
        process.exit(1);
    }
    
    const filesToProcess = await getFilesToProcess(filepath);
    if (!filesToProcess.length) {
        console.log(`Error: No files found at '${filepath}'`);
        process.exit(1);
    }
    
    console.log(`\nProcessing ${filesToProcess.length} files...`);
    const totalStartTime = Date.now();
    
    // Process each file and collect results
    const fileResults = [];
    for (let i = 0; i < filesToProcess.length; i++) {
        const filepath = filesToProcess[i];
        console.log(`\nProcessing file ${i + 1}/${filesToProcess.length}: ${filepath}`);
        const startTime = Date.now();
        
        const results = await countOccurrences(filepath, termGroups);
        if (results) {
            const elapsedTime = (Date.now() - startTime) / 1000;
            console.log(`Completed in ${elapsedTime.toFixed(2)} seconds`);
            fileResults.push([filepath, results]);
        } else {
            const elapsedTime = (Date.now() - startTime) / 1000;
            console.log(`Failed after ${elapsedTime.toFixed(2)} seconds`);
        }
    }
    
    if (fileResults.length) {
        const outputFile = await writeResultsToCsv(fileResults, termGroups);
        const totalTime = (Date.now() - totalStartTime) / 1000;
        console.log(`\nSuccessfully processed ${fileResults.length} out of ${filesToProcess.length} files`);
        console.log(`Total processing time: ${totalTime.toFixed(2)} seconds`);
        console.log(`Results have been written to '${outputFile}'`);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
} 