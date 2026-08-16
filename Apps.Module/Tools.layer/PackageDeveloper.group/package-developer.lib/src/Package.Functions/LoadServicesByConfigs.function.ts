const LoadServicesByConfigsFunction = ({params, configs}: any) => 
    configs
    .reduce((services: any, {name, service}: any) => {
        //try{
            return {
                ...services, 
                [name]: new service(params)
            }
        //}catch(e: any){
            //console.error(e)
        //    return services
       // }
    }, {})

module.exports = LoadServicesByConfigsFunction