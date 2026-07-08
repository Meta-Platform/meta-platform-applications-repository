
import QueryParamsAction from "../Actions/QueryParams.actions"

const QueryParamsReducer = (queryParams:any = {}, action:any) => {
    switch (action.type) {
        case QueryParamsAction.SetQueryParams:
            return action.queryParams
        case QueryParamsAction.AddQueryParam:
            return {...queryParams, [action.param.name]:action.param.value}
        case QueryParamsAction.RemoveQueryParam:
            return Object
			.keys(queryParams)
			.filter(key => key !== action.name)
			.reduce((acc, name) => ({...acc, [name]: queryParams[name]}), {})
        default:
            return queryParams
    }
}

export default QueryParamsReducer
