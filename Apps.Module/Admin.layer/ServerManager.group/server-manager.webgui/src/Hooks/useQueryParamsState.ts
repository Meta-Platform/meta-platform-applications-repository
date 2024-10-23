//@ts-ignore
import qs from "query-string"

//TODO Não usado possivelmente sera removido
const useQueryParamsState = ({location, navigate}:any) => {

    const queryParams = qs.parse(location.search.substr(1))
	
	const changeQueryParams = (newQueryParams:any) => {
        const search = qs.stringify(newQueryParams)
		navigate({search: `?${search}`})
	}

	const addQueryParam = (name:string, value:string) => {
		changeQueryParams({...queryParams, [name]:value})
	}
	
	const removeQueryParam = (name:string) => {

		const newQueryParams = 
			Object
			.keys(queryParams)
			.filter(key => key !== name)
			.reduce((acc, name) => ({...acc, [name]: queryParams[name]}), {})

		changeQueryParams(newQueryParams)
	}
    
    return { queryParams, changeQueryParams, addQueryParam, removeQueryParam }
}

export default useQueryParamsState