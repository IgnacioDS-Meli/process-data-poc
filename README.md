### Folders

Cada folder tiene su respectivo archivo .MD  para ver instrucciones.

- process-data-auto : Permite llamar al api de automatización de casos y generar un csv como reporte final.
- process-data-payment-withdrawals :  Permite procesar la información para generar info de pagos o de retiros.

Primero se debe procesar la data corriendo el fuente process-data-payment-withdrawals ( este se alimentará (cases-payments.csv) o de (cases-withdrawals.csv)) y luego ejecutar el llamado masivo al automatizador por medio de process-data-auto ( este se alimenta de cases.csv que debería tener la misma información puesta en cases-payments.csv o cases-withdrawals.csv) dependiendo de qué es lo que se va a procesar.
