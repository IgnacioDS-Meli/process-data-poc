'use strict';
const csv = require('csv-parser');
const fs = require('fs');
const fetch = require('node-fetch');
let filename;
const data = [];
const results = [];
let count = 0;

const urlPayment = (paymentId, callerId) => `http://api.mp.internal.ml.com/v1/payments/${paymentId}?caller.id=${callerId}`;
const urlUser = (userId) => `http://api.mp.internal.ml.com/users/${userId}/mercadopago_account/balance?caller.id=${userId}`;
const urlProductType = (productId) => `http://api.mp.internal.ml.com/product/${productId}`;
const urlPaymentByDate = (beginDate, endDate, callerId) => `http://api.mp.internal.ml.com/v1/payments/search?range=date_created&begin_date=${beginDate}&end_date=${endDate}&caller.id=${callerId}`;
const urlWithdrawals = (callerId, id) => `http://api.internal.ml.com/withdrawals/search?user_id=${callerId}&caller.id=${callerId}&criteria=desc&id=${id}`; 
const urlCommunications = (caseId, customerId, withdrawalId) => `http://api.internal.ml.com/cx/api/internal/communication/message/case/search?case_id=${caseId}&cust_id=${customerId}&withdraw_id=${withdrawalId}`;

const readline = require('readline');
let option;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ask user for the anme input
console.log('1. Payments');
console.log('2. Withdrawals');
console.log('');
rl.question(`What are we gonna process?  (Enter the number of your option) \n >`, (opt) => {
    option = Number(opt);
    filename= (opt =="1") ? 'cases-payments.csv': 'cases-withdrawals.csv';
    processCSV();
});

const processCSV = () => {
    console.log(`Fetch data from ${filename} and creating output...`);
    fs.createReadStream(filename)
        .pipe(csv())
        .on('data', (row) => {
            count++;
            data.push(row);
        })
        .on('end', () => {
            if (option == "1") {
                fetchDataPagos();
            } else {
                fetchDataRetiros();

            }


        })
        .on('error', (e) => {
            new Error('Error processing CSV :' + e)
        });
};


const addDays = (date, number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + number);
    return d.toISOString();
}
const removeDays = (date, number) => {
    const d = new Date(date);
    d.setDate(d.getDate() - number);
    return d.toISOString();
};

const doRecursiveRequest = (url, limit = 25) =>
    fetch(url).then(res => {
        if (res.status === 405) {
            // 437989442 no autorizado siempre.
            // 79691850,82198682
            console.warn('No autorizado: ' + url);
            console.warn('Reintentando en 3 seg...');
            setTimeout(3000, () => {
                return doRecursiveRequest(url, limit);
            })

        }
        if (res.status !== 200 && --limit) {
            return doRecursiveRequest(url, limit);
        }
        return res.json();
    }).catch(e => {
        console.warn('Retrying : ' + url)
        return doRecursiveRequest(url, limit);
    });

const doRecursiveRequestWithHeaders = (url, limit = 25) =>
    fetch(url, {

        headers: {
            'Content-Type': 'application/json',
            'X-Caller-Scopes': 'admin',
        },
    }).then(res => {
        if (res.status === 405) {
            // 437989442 no autorizado siempre.
            console.warn('No autorizado: ' + url);
            console.warn('Reintentando en 3 seg...');
            setTimeout(3000, () => {
                return doRecursiveRequest(url, limit);
            })

        }
        if (res.status !== 200 && --limit) {
            return doRecursiveRequest(url, limit);
        }
        return res.json();
    }).catch(e => {
        console.warn('Retrying : ' + url)
        return doRecursiveRequest(url, limit);
    });

const fetchDataPagos = async () => {
    await Promise.all(data.map(async (elem) => {
        const { paymentId, customerId, caseId } = elem;
        try {
            const finalFormat = { caseId };
            //Se obtiene la información del payment.
            if (paymentId === 'NULL') {
                console.warn('Payment no encontrado. PaymentId:' + paymentId);
                finalFormat.results = [];
                results.push(finalFormat);
            } else {
                const firstPaymentData = await doRecursiveRequest(urlPayment(paymentId, customerId))
                if (firstPaymentData) {

                    const { date_created, error, message } = firstPaymentData;
                    if (!error) {
                        //A partir de la fecha del payment, se obtiene los totales en un rango de fechas
                        const dateFrom = removeDays(date_created, 1);
                        const dateTo = addDays(date_created, 1);
                        const paymentRangeData = await doRecursiveRequest(urlPaymentByDate(dateFrom, dateTo, customerId));

                        if (paymentRangeData) {
                            let payments = [];
                            await paymentRangeData.results.forEach(async (e) => {
                                const { id, product_id, date_created, status, status_detail, payment_method_id, payment_type_id, transaction_amount, order, additional_info } = e;

                                let items = []
                                if (additional_info && additional_info.items && additional_info.items.length > 0) {
                                    additional_info.items.forEach((x) => {
                                        items.push({
                                            id: x.id,
                                            price: x.unit_price,
                                            quantity: x.quantity,
                                        })
                                    })
                                }
                                const additionalInfo = { items };
                                const dataAdditional = await doRecursiveRequest(urlProductType(product_id))
                                if (dataAdditional) {
                                    payments.push({
                                        paymentId: String(id),
                                        customerId,
                                        product: (dataAdditional && dataAdditional.track) ? dataAdditional.track : 'NULL',
                                        paymentTimestamp: date_created,
                                        status,
                                        statusDetail: status_detail,
                                        paymentMethod: payment_method_id,
                                        paymentType: payment_type_id,
                                        transactionAmount: String(transaction_amount),
                                        order,
                                        additionalInfo,
                                    });
                                    finalFormat.results = payments;
                                }


                            });

                        }
                    } else {
                        console.warn('Payment no encontrado. PaymentId:' + paymentId)
                        finalFormat.results = [];
                    }

                }
                results.push(finalFormat);
            }


        }
        catch (error) {
            console.error(`ERROR general: ${error}, caseId: ${caseId} `);
            results.push({ caseId, results: [] });
        }


    })).then(() => {
        let data = JSON.stringify(results);
        console.log('Registros procesados:' + results.length)
        fs.writeFileSync('cases.json', data);
    }).catch(e => {
        console.error(`ERROR lvl 3 : ${e}`);
    });
};

const fetchDataRetiros = async () => {
    await Promise.all(data.map(async (elem) => {
        const { withdrawalId, customerId, caseId } = elem;
        try {
            const finalFormat = { caseId, notice: [] };
            //Se obtiene la información del payment.
            if (withdrawalId === 'NULL') {
                console.warn('withdrawalId no encontrado. PaymentId:' + withdrawalId);
                finalFormat.results = [];
                results.push(finalFormat);
            } else {
                const withdrawalInfo = await doRecursiveRequest(urlWithdrawals(customerId, withdrawalId))
                if (withdrawalInfo && Array.isArray(withdrawalInfo.results) && withdrawalInfo.results.length > 0) {

                    const { date_paid, date_confirmed, id, amount, date_sent, method, date_created, status_detail, user_id, status, payer_bank } = withdrawalInfo.results[0];
                    const withdrawal = {
                        date_paid,
                        date_confirmed,
                        id,
                        amount,
                        date_sent,
                        method,
                        date_created,
                        status_detail,
                        user_id,
                        status,
                        payer_bank,
                    };
                    finalFormat.withdrawal = withdrawal;

                    const communicationData = await doRecursiveRequestWithHeaders(urlCommunications(caseId, customerId, withdrawalId));

                    if (communicationData) {
                        finalFormat.notice = communicationData.results || [];
                    } else {
                        finalFormat.notice = [];
                    }

                } else {
                    finalFormat.withdrawal = {};
                    finalFormat.notice = [];

                }
                results.push(finalFormat);
            }


        }
        catch (error) {
            console.error(`ERROR general: ${error}, caseId: ${caseId} `);
            results.push({ caseId, withdrawal: {}, notice: [] });
        }


    })).then(() => {
        let data = JSON.stringify(results);
        console.log('Registros procesados:' + results.length);
        if(option =="1"){
            fs.writeFileSync('payments.json', data);
        }else{
            fs.writeFileSync('withdrawals.json', data);
        }
        
    }).catch(e => {
        console.error(`ERROR lvl 3 : ${e}`);
    });
};



