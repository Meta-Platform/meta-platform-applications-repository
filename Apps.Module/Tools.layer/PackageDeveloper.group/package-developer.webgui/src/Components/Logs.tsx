
import React from "react"
import {useState, useEffect}  from "react"
import { bindActionCreators } from "redux"
import { connect }            from "react-redux"

const LogTable = (log:Array<LogType>) => {

    return
}

type LogsProps = {
    PackageManager:any
}

const Logs = ({
    PackageManager
}:LogsProps) =>{

    // Tabela irregular (só cabeçalho, sem linhas): mantém a marcação em
    // `.mp-table` do kit em vez de DataTable, que esconderia o cabeçalho.
    return  <div className="mp-table-wrap">
                <table className="mp-table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                </table>
            </div>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({}, dispatch)

const mapStateToProps = ({PackageManager, QueryParams}:any) => ({
    PackageManager,
    QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(Logs)
