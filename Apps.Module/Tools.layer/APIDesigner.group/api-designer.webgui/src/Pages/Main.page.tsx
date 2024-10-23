import * as React from "react"
import qs from "query-string"
import {
  useLocation,
  useNavigate
} from "react-router-dom"

import APIDesignerContainer from "../Containers/APIDesigner.container"

const MainPage = () => {

  const location = useLocation()
  const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))
	
	const handleChangeQueryParams = (newQueryParams:any) => {
    const search = qs.stringify(newQueryParams)
		navigate({search: `?${search}`})
  }

	return <APIDesignerContainer
                queryParams         = {queryParams}
                onChangeQueryParams = {handleChangeQueryParams}/>
}

export default MainPage