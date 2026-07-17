import QueryParamsAction from "./QueryParams.actions"

export default {
    SetQueryParams   : (queryParams:any) => ({type: QueryParamsAction.SetQueryParams, queryParams}),
    AddQueryParam    : (name:string,  value:string) => ({type: QueryParamsAction.AddQueryParam, param:{name, value}}),
    RemoveQueryParam : (name:string)=> ({type: QueryParamsAction.RemoveQueryParam, name})
}