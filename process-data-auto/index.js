const csv = require('csv-parser');
const fs = require('fs');
const axios = require('axios');

var datetime = new Date();
const actual = datetime.toISOString().slice(0, 10);
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
    path: `output-${actual}-cases.csv`,
    header: [

        {id:'caseId',title:'caseId'},
        {id:'creationDate',title:'creationDate'},
        {id:'customerId',title:'customerId'},
        {id:'caseOrigin',title:'caseOrigin'},
        {id:'bu',title:'bu'},
        {id:'site',title:'site'},
        {id:'processId',title:'processId'},
        {id:'problemId',title:'problemId'},
        {id:'orderId',title:'orderId'},
        {id:'purshaseId',title:'purshaseId'},
        {id:'itemId',title:'itemId'},
        {id:'withdrawalId',title:'withdrawalId'},
        {id:'paymentId',title:'paymentId'},
        {id:'packId',title:'packId'},
        {id:'faqId',title:'faqId'},
        {id:'formId',title:'formId'},
        {id:'message',title:'message'},
        {id:'useCaseFound',title:'useCaseFound'},
        {id:'useCaseName',title:'useCaseName'},
        {id:'executionDate',title:'executionDate'},
        {id:'executionFlow',title:'executionFlow'},
        {id:'shouldAnswer',title:'shouldAnswer'},
        {id:'solutionId',title:'solutionId'},
    ]});

const filename = 'cases.csv';
const data = [];
const results = [];
let count = 0;

const urlAutomatization = 'http://local.adminml.com:8080/case';
const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Token': 'd4a0b2435e87289df9a5ed5b1d26413f253d1cb5cbc29d5e01194a476ea3275f',
}

const processCSV = () => {
    console.log(`Fetch predictions and creating output...`);
    fs.createReadStream(filename)
        .pipe(csv())
        .on('data', (row) => {
            count++;
            data.push(row);
        })
        .on('end', () => {
            fetchPredictions();
        });
};

const fetchPredictions = async () => {
    await Promise.all(data.map(async (elem, idx) => {

        try {
            const resp = await axios.post(urlAutomatization, elem, { headers: headers });
            const { case: { 
                caseId,
                creationDate,
                customerId,
                caseOrigin,
                bu,
                site,
                processId,
                problemId,
                orderId,
                purchaseId,
                itemId,
                withdrawalId,
                paymentId,
                packId,
                faqId,
                formId,
                message }, evaluation: {
                    useCaseFound,
                    useCaseName,
                    executionDate,
                    executionFlow,
                    solution: {
                        shouldAnswer,
                        solutionId
                    }
                } } = resp.data

            const finalResult = {
                caseId,
                creationDate,
                customerId,
                caseOrigin,
                bu,
                site,
                processId,
                problemId,
                orderId,
                purchaseId,
                itemId,
                withdrawalId,
                paymentId,
                packId,
                faqId,
                formId,
                message,
                useCaseFound,
                useCaseName,
                executionDate,
                executionFlow: (executionFlow) ? executionFlow.join(',') : 'N/A',
                shouldAnswer,
                solutionId
            };
            
            results.push(finalResult);
        }
        catch (error) {
            elem.comment = `ERROR: ${error}`;
            results.push(elem);

        }

    })).then(() => {
        let data = JSON.stringify(results);
        console.log('Registros procesados:' + results.length)
        //fs.writeFileSync('cases.json', data);
        csvWriter
            .writeRecords(results)
            .then(() => console.log('The CSV file was written successfully'));
    });
};

processCSV();