
const getTotalPerItem = (listItem:Array<any>, totalItem:number) => 
listItem
? ((listItem.length - (listItem.length % totalItem)) / totalItem) +  (listItem.length % totalItem > 0 ? 1 : 0)
: 1

export default getTotalPerItem