// "datasource-manager" -> "Datasource Manager"
const FormatAppName = (raw:string = ""):string =>
    raw
        .replace(/[-_.]+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")

export default FormatAppName
