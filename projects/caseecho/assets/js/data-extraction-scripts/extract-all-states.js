const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const CONCURRENCY = 3;
const DELAY_BETWEEN_BATCHES = 2000;
const PAGE_LOAD_TIMEOUT = 30000;
const PAGE_WAIT_TIME = 4000;

async function extractCaseData(caseNumber, browser) {
    const startTime = Date.now();
    
    try {
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        let caseId;
        let url;
        let caseType;
        
        if (caseNumber.startsWith('MP')) {
            caseId = caseNumber.replace('MP', '').trim();
            url = `https://www.namus.gov/MissingPersons/Case#/${caseId}?nav`;
            caseType = 'missing';
        } else if (caseNumber.startsWith('UP')) {
            caseId = caseNumber.replace('UP', '').trim();
            url = `https://www.namus.gov/UnidentifiedPersons/Case#/${caseId}?nav`;
            caseType = 'unidentified';
        } else if (caseNumber.startsWith('UCP')) {
            caseId = caseNumber.replace('UCP', '').trim();
            url = `https://www.namus.gov/UnclaimedPersons/Case#/${caseId}?nav`;
            caseType = 'unclaimed';
        } else {
            throw new Error(`Unknown case type: ${caseNumber}`);
        }
        
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: PAGE_LOAD_TIMEOUT
        });
        
        await new Promise(resolve => setTimeout(resolve, PAGE_WAIT_TIME));
        await page.waitForSelector('.data-item', { timeout: 10000 }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const caseData = await page.evaluate(() => {
            const result = {
                heightFeet: null,
                heightInches: null,
                heightFormatted: null,
                weight: null,
                hairColor: null,
                eyeColor: null,
                headHairDescription: null,
                bodyHairDescription: null,
                facialHairDescription: null,
                circumstances: null,
                dnaStatus: null,
                fingerprintsStatus: null,
                dentalStatus: null
            };
            
            const allLabels = Array.from(document.querySelectorAll('span.data-label'));
            
            allLabels.forEach(label => {
                const labelText = label.textContent.trim().toLowerCase();
                const parent = label.closest('.data-item');
                
                if (!parent) return;
                
                const valueElement = parent.querySelector('.data-value, [ng-bind], [ng-bind-html]') || parent;
                let valueText = valueElement.textContent || '';
                
                if (valueText === labelText || valueText.toLowerCase().includes(labelText)) {
                    const allText = parent.textContent || '';
                    valueText = allText.replace(new RegExp(labelText, 'gi'), '').trim();
                }
                
                valueText = valueText.replace(/--/g, '').trim();
                const cleanValue = valueText;
                
                if (labelText.includes('height') && !labelText.includes('thumbnail')) {
                    const feetMatch = valueText.match(/(\d+)\s*['"]?\s*(\d+)\s*["']?/);
                    if (feetMatch) {
                        result.heightFeet = parseInt(feetMatch[1]);
                        result.heightInches = parseInt(feetMatch[2]);
                        result.heightFormatted = `${feetMatch[1]}'${feetMatch[2]}"`;
                    } else {
                        const inchesOnly = valueText.match(/(\d+)\s*(inches|in|"|'')/i);
                        if (inchesOnly) {
                            const totalInches = parseInt(inchesOnly[1]);
                            result.heightFeet = Math.floor(totalInches / 12);
                            result.heightInches = totalInches % 12;
                            result.heightFormatted = `${result.heightFeet}'${result.heightInches}"`;
                        }
                    }
                    
                    const cmMatch = valueText.match(/(\d+)\s*cm/i);
                    if (cmMatch && !result.heightFormatted) {
                        const cm = parseInt(cmMatch[1]);
                        const totalInches = Math.round(cm / 2.54);
                        result.heightFeet = Math.floor(totalInches / 12);
                        result.heightInches = totalInches % 12;
                        result.heightFormatted = `${result.heightFeet}'${result.heightInches}"`;
                    }
                }
                
                if (labelText.includes('weight')) {
                    const weightMatch = valueText.match(/(\d+)\s*(lbs|pounds|lb)/i);
                    if (weightMatch) {
                        result.weight = parseInt(weightMatch[1]);
                    }
                }
                
                if ((labelText.includes('hair color') || labelText === 'hair color') && !labelText.includes('body') && !labelText.includes('facial') && !labelText.includes('head')) {
                    const hairClean = cleanValue.replace(/hair color/gi, '').replace(/--/g, '').trim();
                    if (hairClean && hairClean.length > 0 && hairClean.length < 50 && 
                        !hairClean.toLowerCase().includes('hair color') && 
                        hairClean !== '--' && hairClean !== '') {
                        result.hairColor = hairClean.split('\n')[0].split(',')[0].trim();
                    }
                }
                
                if ((labelText.includes('eye color') || labelText.includes('left eye') || labelText.includes('right eye')) && !labelText.includes('description')) {
                    const eyeClean = cleanValue.replace(/eye color/gi, '').replace(/left|right/gi, '').replace(/--/g, '').trim();
                    if (eyeClean && eyeClean.length > 0 && eyeClean.length < 50 && 
                        !eyeClean.toLowerCase().includes('eye color') && 
                        eyeClean !== '--' && eyeClean !== '') {
                        result.eyeColor = eyeClean.split('\n')[0].split(',')[0].trim();
                    }
                }
                
                if (labelText.includes('head hair description')) {
                    const descClean = cleanValue.replace(/head hair description/gi, '').replace(/--/g, '').trim();
                    if (descClean && descClean.length > 0 && 
                        !descClean.toLowerCase().includes('head hair description') &&
                        descClean !== '--') {
                        result.headHairDescription = descClean;
                    }
                }
                
                if (labelText.includes('body hair description')) {
                    const descClean = cleanValue.replace(/body hair description/gi, '').replace(/--/g, '').trim();
                    if (descClean && descClean.length > 0 && 
                        !descClean.toLowerCase().includes('body hair description') &&
                        descClean !== '--') {
                        result.bodyHairDescription = descClean;
                    }
                }
                
                if (labelText.includes('facial hair description')) {
                    const descClean = cleanValue.replace(/facial hair description/gi, '').replace(/--/g, '').trim();
                    if (descClean && descClean.length > 0 && 
                        !descClean.toLowerCase().includes('facial hair description') &&
                        descClean !== '--') {
                        result.facialHairDescription = descClean;
                    }
                }
                
                if (labelText.includes('circumstance') || labelText.includes('circumstances')) {
                    const circClean = cleanValue.replace(/circumstances?/gi, '').replace(/of disappearance/gi, '').replace(/of discovery/gi, '').replace(/--/g, '').trim();
                    if (circClean && circClean.length > 0 && 
                        !circClean.toLowerCase().includes('circumstances') &&
                        circClean !== '--') {
                        result.circumstances = circClean;
                    }
                }
                
                if (labelText.includes('dna') && (labelText.includes('status') || labelText.includes('available'))) {
                    const dnaClean = cleanValue.replace(/dna/gi, '').replace(/status/gi, '').replace(/available/gi, '').replace(/--/g, '').trim();
                    if (dnaClean && dnaClean.length > 0 && 
                        !dnaClean.toLowerCase().includes('dna status') &&
                        dnaClean !== '--') {
                        result.dnaStatus = dnaClean;
                    }
                }
                
                if (labelText.includes('fingerprint') && (labelText.includes('status') || labelText.includes('available'))) {
                    const fpClean = cleanValue.replace(/fingerprint/gi, '').replace(/status/gi, '').replace(/available/gi, '').replace(/--/g, '').trim();
                    if (fpClean && fpClean.length > 0 && 
                        !fpClean.toLowerCase().includes('fingerprint status') &&
                        fpClean !== '--') {
                        result.fingerprintsStatus = fpClean;
                    }
                }
                
                if (labelText.includes('dental') && (labelText.includes('status') || labelText.includes('available'))) {
                    const dentalClean = cleanValue.replace(/dental/gi, '').replace(/status/gi, '').replace(/available/gi, '').replace(/--/g, '').trim();
                    if (dentalClean && dentalClean.length > 0 && 
                        !dentalClean.toLowerCase().includes('dental status') &&
                        dentalClean !== '--') {
                        result.dentalStatus = dentalClean;
                    }
                }
            });
            
            const allText = document.body.textContent || '';
            
            if (!result.hairColor) {
                const hairPatterns = [
                    /hair\s*color[:\s]+([^,\n]{1,30})/i,
                    /hair[:\s]+([^,\n]{1,30})/i
                ];
                for (const pattern of hairPatterns) {
                    const match = allText.match(pattern);
                    if (match && match[1]) {
                        const hairValue = match[1].trim();
                        if (hairValue && hairValue.length < 50 && 
                            !hairValue.toLowerCase().includes('hair color') &&
                            !hairValue.toLowerCase().includes('description')) {
                            result.hairColor = hairValue;
                            break;
                        }
                    }
                }
            }
            
            if (!result.eyeColor) {
                const eyePatterns = [
                    /eye\s*color[:\s]+([^,\n]{1,30})/i,
                    /(?:left|right)\s*eye[:\s]+([^,\n]{1,30})/i
                ];
                for (const pattern of eyePatterns) {
                    const match = allText.match(pattern);
                    if (match && match[1]) {
                        const eyeValue = match[1].trim();
                        if (eyeValue && eyeValue.length < 50 && 
                            !eyeValue.toLowerCase().includes('eye color') &&
                            !eyeValue.toLowerCase().includes('description')) {
                            result.eyeColor = eyeValue;
                            break;
                        }
                    }
                }
            }
            
            return result;
        });
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        await page.close();
        
        return {
            caseNumber,
            caseType,
            ...caseData,
            duration: parseFloat(duration),
            success: caseData.heightFormatted !== null || caseData.weight !== null || caseData.hairColor !== null || caseData.eyeColor !== null
        };
        
    } catch (error) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        return {
            caseNumber,
            caseType: 'unknown',
            error: error.message,
            duration: parseFloat(duration),
            success: false
        };
    }
}

async function getAllCaseNumbers() {
    const caseNumbers = [];
    const dataDir = path.join(__dirname, '..', 'assets', 'data');
    
    const caseTypes = ['missing', 'unidentified', 'unclaimed'];
    
    for (const caseType of caseTypes) {
        const typeDir = path.join(dataDir, caseType);
        if (!fs.existsSync(typeDir)) continue;
        
        const files = fs.readdirSync(typeDir).filter(f => f.endsWith('.csv'));
        
        for (const file of files) {
            const filepath = path.join(typeDir, file);
            await new Promise((resolve, reject) => {
                fs.createReadStream(filepath, { encoding: 'utf8' })
                    .pipe(csv({
                        mapHeaders: ({ header }) => header.replace(/^\ufeff/, '').trim()
                    }))
                    .on('data', (row) => {
                        let caseNumber = null;
                        
                        const keys = Object.keys(row);
                        const firstKey = keys[0] || '';
                        const firstValue = Object.values(row)[0];
                        
                        if (caseType === 'missing' || caseType === 'unclaimed') {
                            caseNumber = row['Case Number'] || 
                                        row['case number'] || 
                                        row['CaseNumber'] ||
                                        row[firstKey] ||
                                        firstValue;
                        } else if (caseType === 'unidentified') {
                            caseNumber = row['Case'] || 
                                        row['case'] || 
                                        row['Case Number'] ||
                                        row[firstKey] ||
                                        firstValue;
                        }
                        
                        if (caseNumber) {
                            caseNumber = caseNumber.toString().trim().replace(/"/g, '').replace(/\ufeff/g, '');
                            if (caseNumber && caseNumber.length > 0 && caseNumber.match(/^(MP|UP|UCP)\d+/i) && !caseNumbers.includes(caseNumber)) {
                                caseNumbers.push(caseNumber);
                            }
                        }
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });
        }
    }
    
    return caseNumbers.sort();
}

async function processBatch(caseNumbers, startIndex, concurrency, browser) {
    const batch = caseNumbers.slice(startIndex, startIndex + concurrency);
    
    const promises = batch.map(caseNumber => {
        return extractCaseData(caseNumber, browser).catch(error => {
            return {
                caseNumber,
                caseType: 'unknown',
                error: error.message,
                duration: 0,
                success: false
            };
        });
    });
    
    return await Promise.all(promises);
}

async function extractAllStates(outputFile, progressFile, concurrency = CONCURRENCY) {
    console.log('Loading all case numbers from CSV files...');
    const allCaseNumbers = await getAllCaseNumbers();
    console.log(`Found ${allCaseNumbers.length.toLocaleString()} total cases\n`);
    
    let processedCases = new Set();
    let allResults = [];
    
    if (fs.existsSync(progressFile)) {
        const progressData = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
        processedCases = new Set(progressData.processedCases || []);
        allResults = progressData.results || [];
        console.log(`Resuming: ${processedCases.size.toLocaleString()} cases already processed`);
        console.log(`Remaining: ${(allCaseNumbers.length - processedCases.size).toLocaleString()} cases\n`);
    }
    
    const remainingCases = allCaseNumbers.filter(c => !processedCases.has(c));
    
    if (remainingCases.length === 0) {
        console.log('All cases already processed!');
        return allResults;
    }
    
    console.log(`Starting extraction for ${remainingCases.length.toLocaleString()} cases...`);
    console.log(`Concurrency: ${concurrency} parallel browsers`);
    console.log(`Estimated time: ~${((remainingCases.length * 4.5) / 3600).toFixed(1)} hours`);
    console.log('=' .repeat(60));
    console.log('\n⚠️  TO PAUSE: Press Ctrl+C (progress will be saved automatically)');
    console.log('⚠️  TO RESUME: Run this script again (it will auto-resume)\n');
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    const totalBatches = Math.ceil(remainingCases.length / concurrency);
    
    let shouldStop = false;
    
    process.on('SIGINT', () => {
        console.log('\n\n⚠️  Pause requested... Finishing current batch and saving progress...');
        shouldStop = true;
    });
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    try {
        for (let i = 0; i < remainingCases.length && !shouldStop; i += concurrency) {
            const batchNum = Math.floor(i / concurrency) + 1;
            const batch = remainingCases.slice(i, i + concurrency);
            
            console.log(`\n[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} cases...`);
            
            const batchStart = Date.now();
            const batchResults = await processBatch(remainingCases, i, concurrency, browser);
            
            batchResults.forEach((result, idx) => {
                const caseNum = batch[idx];
                processedCases.add(caseNum);
                allResults.push(result);
                
                if (result.success) {
                    const details = [];
                    if (result.heightFormatted) details.push(`H:${result.heightFormatted}`);
                    if (result.weight) details.push(`W:${result.weight}lbs`);
                    if (result.hairColor) details.push(`Hair:${result.hairColor.substring(0, 15)}`);
                    console.log(`  ✓ ${caseNum}: ${details.join(' ')} (${result.duration}s)`);
                } else if (result.error) {
                    console.log(`  ✗ ${caseNum}: Error - ${result.error.substring(0, 50)} (${result.duration}s)`);
                } else {
                    console.log(`  - ${caseNum}: No data (${result.duration}s)`);
                }
            });
            
            const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
            const elapsed = (Date.now() - startTime) / 1000;
            const processed = allResults.length;
            const avgTime = elapsed / processed;
            const remaining = avgTime * (remainingCases.length - i - batch.length);
            
            console.log(`  Batch: ${batchTime}s | Total: ${processed.toLocaleString()}/${allCaseNumbers.length.toLocaleString()} | Avg: ${avgTime.toFixed(1)}s/case | Est. remaining: ${(remaining / 3600).toFixed(1)}h`);
            
            const progressData = {
                processedCases: Array.from(processedCases),
                results: allResults,
                lastUpdate: new Date().toISOString(),
                totalCases: allCaseNumbers.length,
                processed: processed,
                remaining: remainingCases.length - i - batch.length
            };
            fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
            
            if (shouldStop) {
                console.log('\n✓ Progress saved. You can resume by running this script again.');
                break;
            }
            
            if (i + concurrency < remainingCases.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }
    } finally {
        await browser.close();
    }
    
    const csvRows = [
        ['Case Number', 'Case Type', 'Height Feet', 'Height Inches', 'Height Formatted', 'Weight (lbs)', 
         'Hair Color', 'Eye Color', 'Head Hair Description', 'Body Hair Description', 'Facial Hair Description',
         'Circumstances', 'DNA Status', 'Fingerprints Status', 'Dental Status', 'Success', 'Duration (s)', 'Error']
    ];
    
    allResults.forEach(r => {
        csvRows.push([
            r.caseNumber || '',
            r.caseType || '',
            r.heightFeet || '',
            r.heightInches || '',
            r.heightFormatted || '',
            r.weight || '',
            r.hairColor || '',
            r.eyeColor || '',
            r.headHairDescription || '',
            r.bodyHairDescription || '',
            r.facialHairDescription || '',
            r.circumstances || '',
            r.dnaStatus || '',
            r.fingerprintsStatus || '',
            r.dentalStatus || '',
            r.success ? 'Yes' : 'No',
            r.duration || '',
            r.error || ''
        ]);
    });
    
    const csvContent = csvRows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    fs.writeFileSync(outputFile, csvContent);
    
    const totalTime = (Date.now() - startTime) / 1000;
    const successful = allResults.filter(r => r.success).length;
    
    console.log('\n' + '=' .repeat(60));
    console.log('Extraction complete!');
    console.log(`Total cases: ${allCaseNumbers.length.toLocaleString()}`);
    console.log(`Processed: ${allResults.length.toLocaleString()}`);
    console.log(`Successful: ${successful.toLocaleString()}`);
    console.log(`Failed: ${(allResults.length - successful).toLocaleString()}`);
    console.log(`Total time: ${(totalTime / 3600).toFixed(1)} hours`);
    console.log(`Average: ${(totalTime / allResults.length).toFixed(1)} seconds per case`);
    console.log(`\nResults saved to: ${outputFile}`);
    
    return allResults;
}

const outputFile = path.join(__dirname, 'extracted-all-physical-data.csv');
const progressFile = path.join(__dirname, 'extraction-progress-full.json');

extractAllStates(outputFile, progressFile, CONCURRENCY)
    .then(() => {
        console.log('\n✓ Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n✗ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
