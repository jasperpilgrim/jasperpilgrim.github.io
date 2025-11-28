const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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
                distinguishingMarks: null,
                clothing: null,
                jewelry: null,
                circumstances: null,
                dnaStatus: null,
                fingerprintsStatus: null,
                dentalStatus: null,
                photos: [],
                lastSeenLocation: null,
                vehicleInfo: null,
                medicalConditions: null,
                tattoos: null,
                scars: null,
                otherCharacteristics: null
            };
            
            const allLabels = Array.from(document.querySelectorAll('span.data-label'));
            const allItems = Array.from(document.querySelectorAll('.data-item'));
            const allText = document.body.textContent || '';
            
            allLabels.forEach(label => {
                const labelText = label.textContent.trim().toLowerCase();
                const parent = label.closest('.data-item');
                
                if (!parent) return;
                
                const itemText = parent.textContent || '';
                const valueText = itemText.replace(labelText, '').trim();
                const cleanValue = valueText.replace(/--/g, '').trim();
                
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
                    if (cleanValue && cleanValue.length < 100 && cleanValue !== '') {
                        result.hairColor = cleanValue;
                    }
                }
                
                if ((labelText.includes('eye color') || labelText.includes('left eye') || labelText.includes('right eye')) && !labelText.includes('description')) {
                    if (cleanValue && cleanValue.length < 100 && cleanValue !== '') {
                        result.eyeColor = cleanValue;
                    }
                }
                
                if (labelText.includes('head hair description')) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.headHairDescription = cleanValue;
                    }
                }
                
                if (labelText.includes('body hair description')) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.bodyHairDescription = cleanValue;
                    }
                }
                
                if (labelText.includes('facial hair description')) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.facialHairDescription = cleanValue;
                    }
                }
                
                if (labelText.includes('distinguishing') || labelText.includes('mark')) {
                    if (cleanValue && cleanValue.length > 0) {
                        if (!result.distinguishingMarks) {
                            result.distinguishingMarks = cleanValue;
                        } else {
                            result.distinguishingMarks += '; ' + cleanValue;
                        }
                    }
                }
                
                if (labelText.includes('tattoo')) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.tattoos = cleanValue;
                    }
                }
                
                if (labelText.includes('scar')) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.scars = cleanValue;
                    }
                }
                
                if (labelText.includes('clothing') || labelText.includes('wearing')) {
                    if (cleanValue && cleanValue.length > 0) {
                        if (!result.clothing) {
                            result.clothing = cleanValue;
                        } else {
                            result.clothing += '; ' + cleanValue;
                        }
                    }
                }
                
                if (labelText.includes('jewelry')) {
                    if (cleanValue && cleanValue.length > 0) {
                        if (!result.jewelry) {
                            result.jewelry = cleanValue;
                        } else {
                            result.jewelry += '; ' + cleanValue;
                        }
                    }
                }
                
                if (labelText.includes('circumstance') || labelText.includes('circumstances')) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.circumstances = cleanValue;
                    }
                }
                
                if (labelText.includes('dna') && (labelText.includes('status') || labelText.includes('available'))) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.dnaStatus = cleanValue;
                    }
                }
                
                if (labelText.includes('fingerprint') && (labelText.includes('status') || labelText.includes('available'))) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.fingerprintsStatus = cleanValue;
                    }
                }
                
                if (labelText.includes('dental') && (labelText.includes('status') || labelText.includes('available'))) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.dentalStatus = cleanValue;
                    }
                }
                
                if (labelText.includes('last seen') || labelText.includes('missing from')) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.lastSeenLocation = cleanValue;
                    }
                }
                
                if (labelText.includes('vehicle')) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.vehicleInfo = cleanValue;
                    }
                }
                
                if (labelText.includes('medical') || labelText.includes('condition')) {
                    if (cleanValue && cleanValue.length > 0) {
                        result.medicalConditions = cleanValue;
                    }
                }
            });
            
            const images = Array.from(document.querySelectorAll('img[src*="namus"], img[ng-src*="namus"]'));
            result.photos = images.map(img => img.src || img.getAttribute('ng-src') || '').filter(src => src && src.includes('namus')).slice(0, 5);
            
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

async function processBatch(caseNumbers, startIndex, concurrency) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const results = [];
    const batch = caseNumbers.slice(startIndex, startIndex + concurrency);
    
    const promises = batch.map(caseNumber => extractCaseData(caseNumber, browser));
    const batchResults = await Promise.all(promises);
    
    results.push(...batchResults);
    
    await browser.close();
    return results;
}

async function extractAllData(caseNumbers, outputFile, progressFile, concurrency = CONCURRENCY) {
    let processedCases = new Set();
    let allResults = [];
    
    if (fs.existsSync(progressFile)) {
        const progressData = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
        processedCases = new Set(progressData.processedCases || []);
        allResults = progressData.results || [];
        console.log(`Resuming: ${processedCases.size} cases already processed`);
    }
    
    const remainingCases = caseNumbers.filter(c => !processedCases.has(c));
    
    if (remainingCases.length === 0) {
        console.log('All cases already processed!');
        return allResults;
    }
    
    console.log(`Extracting data for ${remainingCases.length} cases...`);
    console.log(`Concurrency: ${concurrency} parallel browsers`);
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    const totalBatches = Math.ceil(remainingCases.length / concurrency);
    
    for (let i = 0; i < remainingCases.length; i += concurrency) {
        const batchNum = Math.floor(i / concurrency) + 1;
        const batch = remainingCases.slice(i, i + concurrency);
        
        console.log(`\n[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} cases...`);
        
        const batchStart = Date.now();
        const batchResults = await processBatch(remainingCases, i, concurrency);
        
        batchResults.forEach((result, idx) => {
            const caseNum = batch[idx];
            processedCases.add(caseNum);
            allResults.push(result);
            
            if (result.success) {
                console.log(`  ✓ ${caseNum}: H:${result.heightFormatted || 'N/A'} W:${result.weight || 'N/A'}lbs ${result.hairColor ? 'Hair:' + result.hairColor : ''} ${result.eyeColor ? 'Eye:' + result.eyeColor : ''} (${result.duration}s)`);
            } else if (result.error) {
                console.log(`  ✗ ${caseNum}: Error - ${result.error} (${result.duration}s)`);
            } else {
                console.log(`  - ${caseNum}: No data found (${result.duration}s)`);
            }
        });
        
        const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
        const elapsed = (Date.now() - startTime) / 1000;
        const avgTime = elapsed / (i + batch.length);
        const remaining = avgTime * (remainingCases.length - i - batch.length);
        
        console.log(`  Batch time: ${batchTime}s | Total: ${allResults.length}/${caseNumbers.length} | Est. remaining: ${(remaining / 60).toFixed(1)} min`);
        
        const progressData = {
            processedCases: Array.from(processedCases),
            results: allResults,
            lastUpdate: new Date().toISOString()
        };
        fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
        
        if (i + concurrency < remainingCases.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
    }
    
    const csvRows = [
        ['Case Number', 'Case Type', 'Height Feet', 'Height Inches', 'Height Formatted', 'Weight (lbs)', 
         'Hair Color', 'Eye Color', 'Head Hair Description', 'Body Hair Description', 'Facial Hair Description',
         'Distinguishing Marks', 'Tattoos', 'Scars', 'Clothing', 'Jewelry', 'Circumstances',
         'DNA Status', 'Fingerprints Status', 'Dental Status', 'Last Seen Location', 'Vehicle Info', 
         'Medical Conditions', 'Photos', 'Success', 'Duration (s)', 'Error']
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
            r.distinguishingMarks || '',
            r.tattoos || '',
            r.scars || '',
            r.clothing || '',
            r.jewelry || '',
            r.circumstances || '',
            r.dnaStatus || '',
            r.fingerprintsStatus || '',
            r.dentalStatus || '',
            r.lastSeenLocation || '',
            r.vehicleInfo || '',
            r.medicalConditions || '',
            (r.photos || []).join('; ') || '',
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
    console.log(`Total cases: ${caseNumbers.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${caseNumbers.length - successful}`);
    console.log(`Total time: ${(totalTime / 60).toFixed(1)} minutes`);
    console.log(`Average: ${(totalTime / caseNumbers.length).toFixed(1)} seconds per case`);
    console.log(`\nResults saved to: ${outputFile}`);
    
    return allResults;
}

const caseNumbers = process.argv.slice(2);

if (caseNumbers.length === 0) {
    console.log('Usage: node extract-all-data.js <case1> <case2> ...');
    console.log('Example: node extract-all-data.js MP148109 MP148110 MP148111');
    console.log('\nOptions:');
    console.log('  - Concurrency: Edit CONCURRENCY constant (default: 3)');
    console.log('  - Progress is auto-saved and can be resumed');
    process.exit(1);
}

const outputFile = path.join(__dirname, 'extracted-all-data.csv');
const progressFile = path.join(__dirname, 'extraction-progress.json');

extractAllData(caseNumbers, outputFile, progressFile, CONCURRENCY)
    .then(() => {
        console.log('\n✓ Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n✗ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    });

