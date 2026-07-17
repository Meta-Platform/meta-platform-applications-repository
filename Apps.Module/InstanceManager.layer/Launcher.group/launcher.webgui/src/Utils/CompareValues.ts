import CompareObjects from "./CompareObjects"

function CompareValues(value1, value2) {
    if (value1 === value2) {
        return true
    }

    if (typeof value1 === 'object' && typeof value2 === 'object') {
        return CompareObjects(value1, value2)
    }

    return false
}

export default CompareValues