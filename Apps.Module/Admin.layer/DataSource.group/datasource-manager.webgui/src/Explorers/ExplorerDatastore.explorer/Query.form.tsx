import React from "react"
import { Button, Checkbox, Form } from "semantic-ui-react"

const Operators  = [
    { value: "==", text: "equals"},
    { value: "!=", text: "not equal" },
    { value: "<", text: "less than"},
    { value: "<=", text: "less than or equals"},
    { value: ">", text: "greater than" },
    { value: ">=", text: "greater than or equals" },
    { value: "[]", text: "member of" },
    { value: "![]", text: "not a member of" },
    { value: "{}", text: "field exists" },
    { value: "regex", text: "regular expression" }
  ].map((({value, text}, key) => ({key, value, text})))


const ArrayFields = [
    { value: "size", text:"size of the array"},
    { value: "elemMatch", text:"elementMatch"},
]

const LogicalOperators  = [
    { value: "&&", text:"and"},//{ $op: [query1, query2, ...] }.
    { value: "||", text:"or"},//{ $op: [query1, query2, ...] }.
    { value: "!", text:"not"},//{ $not: query }
    { value: "where", text:"where"},//{ $where: function () { /* object is "this",
]

/*
const LogicalOperators  = [
    { value: "", text:""},
    { value: "", text:""},
    { value: "", text:""},
    { value: "", text:""},
]*/

const QueryForm = () => 
  	<Form>
		<Form.Select
			fluid
			label       = "Operators"
			options     = {Operators}
			placeholder = "Operators"/>
		<Form.Select
			fluid
			label       = "ArrayFields"
			options     = {ArrayFields}
			placeholder = "ArrayFields"/>
		<Form.Select
			fluid
			label       = "LogicalOperators"
			options     = {LogicalOperators}
			placeholder = "LogicalOperators"/>
	</Form>


export default QueryForm