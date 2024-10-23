const LoadServicesByConfigsFunction = ({params, configs}) => 
    configs
    .reduce((services, {name, service}) => {
        //try{
            return {
                ...services, 
                [name]: new service(params)
            }
        //}catch(e){
            //console.error(e)
        //    return services
       // }
    }, {})

module.exports = LoadServicesByConfigsFunction