const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function extractCaseData(caseNumber, browser) {
    const startTime = Date.now();
    
    try {
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
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
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await page.waitForSelector('.data-item', { timeout: 15000 }).catch(() => {});
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const caseData = await page.evaluate(() => {
            const result = {
                heightFeet: null,
                heightInches: null,
                heightFormatted: null,
                weight: null,
                hairColor: null,
                eyeColor: null,
                distinguishingMarks: null,
                clothing: null,
                jewelry: null,
                circumstances: null,
                found: false
            };
            
            const allLabels = Array.from(document.querySelectorAll('span.data-label'));
            const allItems = Array.from(document.querySelectorAll('.data-item'));
            
            allLabels.forEach(label => {
                const labelText = label.textContent.trim().toLowerCase();
                const parent = label.closest('.data-item');
                
                if (!parent) return;
                
                const itemText = parent.textContent || '';
                const valueText = itemText.replace(labelText, '').trim();
                
                if (labelText.includes('height')) {
                    const feetMatch = valueText.match(/(\d+)\s*['"]?\s*(\d+)\s*["']?/);
                    if (feetMatch) {
                        result.heightFeet = parseInt(feetMatch[1]);
                        result.heightInches = parseInt(feetMatch[2]);
                        result.heightFormatted = `${feetMatch[1]}'${feetMatch[2]}"`;
                        result.found = true;
                    } else {
                        const inchesOnly = valueText.match(/(\d+)\s*(inches|in|"|'')/i);
                        if (inchesOnly) {
                            const totalInches = parseInt(inchesOnly[1]);
                            result.heightFeet = Math.floor(totalInches / 12);
                            result.heightInches = totalInches % 12;
                            result.heightFormatted = `${result.heightFeet}'${result.heightInches}"`;
                            result.found = true;
                        }
                    }
                    
                    const cmMatch = valueText.match(/(\d+)\s*cm/i);
                    if (cmMatch && !result.found) {
                        const cm = parseInt(cmMatch[1]);
                        const totalInches = Math.round(cm / 2.54);
                        result.heightFeet = Math.floor(totalInches / 12);
                        result.heightInches = totalInches % 12;
                        result.heightFormatted = `${result.heightFeet}'${result.heightInches}"`;
                        result.found = true;
                    }
                }
                
                if (labelText.includes('weight')) {
                    const weightMatch = valueText.match(/(\d+)\s*(lbs|pounds|lb)/i);
                    if (weightMatch) {
                        result.weight = parseInt(weightMatch[1]);
                    }
                }
                
                if ((labelText.includes('hair color') || labelText === 'hair color') && !labelText.includes('body') && !labelText.includes('facial') && !labelText.includes('head')) {
                    const cleanValue = valueText.replace(/hair color/gi, '').trim();
                    if (cleanValue && cleanValue !== '--' && cleanValue.length < 50) {
                        result.hairColor = cleanValue;
                    }
                }
                
                if ((labelText.includes('eye color') || labelText.includes('left eye') || labelText.includes('right eye')) && !labelText.includes('description')) {
                    const cleanValue = valueText.replace(/eye color/gi, '').replace(/left|right/gi, '').trim();
                    if (cleanValue && cleanValue !== '--' && cleanValue.length < 50) {
                        result.eyeColor = cleanValue;
                    }
                }
                
                if (labelText.includes('distinguishing') || labelText.includes('mark') || labelText.includes('scar') || labelText.includes('tattoo')) {
                    if (!result.distinguishingMarks) {
                        result.distinguishingMarks = valueText || null;
                    } else {
                        result.distinguishingMarks += '; ' + valueText;
                    }
                }
                
                if (labelText.includes('clothing') || labelText.includes('wearing')) {
                    if (!result.clothing) {
                        result.clothing = valueText || null;
                    } else {
                        result.clothing += '; ' + valueText;
                    }
                }
                
                if (labelText.includes('jewelry')) {
                    if (!result.jewelry) {
                        result.jewelry = valueText || null;
                    } else {
                        result.jewelry += '; ' + valueText;
                    }
                }
                
                if (labelText.includes('circumstance') || labelText.includes('circumstances')) {
                    result.circumstances = valueText || null;
                }
            });
            
            const allText = document.body.textContent || '';
            
            if (!result.hairColor) {
                const hairMatch = allText.match(/hair[:\s]+([^,\n]{1,30})/i);
                if (hairMatch) {
                    result.hairColor = hairMatch[1].trim();
                }
            }
            
            if (!result.eyeColor) {
                const eyeMatch = allText.match(/eye[:\s]+([^,\n]{1,30})/i);
                if (eyeMatch) {
                    result.eyeColor = eyeMatch[1].trim();
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
            success: caseData.found || caseData.weight !== null || caseData.hairColor !== null || caseData.eyeColor !== null
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

async function extractBatch(caseNumbers, outputFile, delayMs = 5000) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const results = [];
    const startTime = Date.now();
    
    console.log(`Extracting data for ${caseNumbers.length} cases...`);
    console.log(`Delay between requests: ${delayMs / 1000} seconds`);
    console.log('=' .repeat(60));
    
    for (let i = 0; i < caseNumbers.length; i++) {
        const caseNumber = caseNumbers[i];
        const progress = `[${i + 1}/${caseNumbers.length}]`;
        
        console.log(`\n${progress} Processing: ${caseNumber}`);
        
        const result = await extractCaseData(caseNumber, browser);
        results.push(result);
        
        if (result.success) {
            console.log(`  ✓ Height: ${result.heightFormatted || 'N/A'}, Weight: ${result.weight || 'N/A'} lbs`);
            if (result.hairColor) console.log(`    Hair: ${result.hairColor}`);
            if (result.eyeColor) console.log(`    Eye: ${result.eyeColor}`);
        } else if (result.error) {
            console.log(`  ✗ Error: ${result.error}`);
        } else {
            console.log(`  - No physical data found`);
        }
        
        console.log(`  Time: ${result.duration}s`);
        
        if (i < caseNumbers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        if ((i + 1) % 10 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const avgTime = elapsed / (i + 1);
            const remaining = avgTime * (caseNumbers.length - i - 1);
            console.log(`\n  Progress: ${i + 1}/${caseNumbers.length} | Avg: ${avgTime.toFixed(1)}s/case | Est. remaining: ${(remaining / 60).toFixed(1)} min`);
        }
    }
    
    await browser.close();
    
    const csvRows = [
        ['Case Number', 'Case Type', 'Height Feet', 'Height Inches', 'Height Formatted', 'Weight (lbs)', 'Hair Color', 'Eye Color', 'Distinguishing Marks', 'Clothing', 'Jewelry', 'Circumstances', 'Success', 'Duration (s)', 'Error']
    ];
    
    results.forEach(r => {
        csvRows.push([
            r.caseNumber || '',
            r.caseType || '',
            r.heightFeet || '',
            r.heightInches || '',
            r.heightFormatted || '',
            r.weight || '',
            r.hairColor || '',
            r.eyeColor || '',
            r.distinguishingMarks || '',
            r.clothing || '',
            r.jewelry || '',
            r.circumstances || '',
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
    const successful = results.filter(r => r.success).length;
    
    console.log('\n' + '=' .repeat(60));
    console.log('Batch extraction complete!');
    console.log(`Total cases: ${caseNumbers.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${caseNumbers.length - successful}`);
    console.log(`Total time: ${(totalTime / 60).toFixed(1)} minutes`);
    console.log(`Average: ${(totalTime / caseNumbers.length).toFixed(1)} seconds per case`);
    console.log(`\nResults saved to: ${outputFile}`);
    
    return results;
}

const caseNumbers = process.argv.slice(2);

if (caseNumbers.length === 0) {
    console.log('Usage: node extract-case-data.js <case1> <case2> ...');
    console.log('Example: node extract-case-data.js MP148109 MP148110 MP148111');
    process.exit(1);
}

const outputFile = path.join(__dirname, 'extracted-case-data.csv');

extractBatch(caseNumbers, outputFile, 5000)
    .then(() => {
        console.log('\n✓ Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n✗ Error:', error.message);
        process.exit(1);
    });

