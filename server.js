const express = require("express");
var bodyParser = require('body-parser')
const makeRequest = require('./utilities').makeRequest;

const PORT = process.env.PORT || 3001;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const CURRENCY = "EUR"
const COUNTRY = "BE"

const CLIENT_EWALLET = "ewallet_accdb0461e03b8388364561117429c17"

const personPaymentMethodMap = {
  "A": "card_0e1af913cc966bcfa8fd7ec3a9438fd2",
  "B": "card_51de73fd1cb074287c666ade29fb7bed",
  "C": "card_d780f6a191c0cbfbf9a67f23922b010c"
}

const paymentMethodPersonMap = {
  "card_0e1af913cc966bcfa8fd7ec3a9438fd2": "A",
  "card_51de73fd1cb074287c666ade29fb7bed": "B",
  "card_d780f6a191c0cbfbf9a67f23922b010c": "C"
}

const basePaymentObj = {
    "amount": null,
    "currency": "USD",
    "description": "Payment by card token",
    "payment_method": null,
    "ewallet": CLIENT_EWALLET,
    "metadata": {
    }
}

const makePayment = async (personId, paymentAmount, fullPrice, itemId, capture) => {
  let paymentObj = { ...basePaymentObj }
  paymentObj.amount = paymentAmount
  paymentObj.metadata.itemId = itemId
  paymentObj.metadata.fullPrice = fullPrice
  paymentObj.payment_method = personPaymentMethodMap[personId]
  paymentObj.capture = capture

  try {
      const body = {
        ...paymentObj
      };
      const result = await makeRequest('POST', '/v1/payments', body);
      return result
  } catch (error) {
      return error
  }

}

app.get("/api", (req, res) => {
  res.json({ message: "Hello from server!" });
});

const getAllPayments = async () => {
  const result = await makeRequest('GET', '/v1/payment');
  return result.body.data
}

const findRelevantPayments = (allPayments, splitPayId) => {
  var newArr = []
  allPayments.forEach((payment) => {
    if (payment.metadata.splitPayId === splitPayId) {
      newArr.push(payment)
    }
  })
  return newArr
}

const calculateAmountPaid = (payments) => {
  var totalAuthed = 0
  payments.forEach((payment) => {
    totalAuthed += payment.original_amount
  })
  return totalAuthed
}

const buildPaymentsArr = (relevantPayments) => {
  var paymentsArr = []
  relevantPayments.forEach((paymentObj) => {
    paymentsArr.push({
      amount: paymentObj.original_amount,
      currency: paymentObj.currency_code,
      payment_method: paymentObj.payment_method,
      capture: true,
      metadata: paymentObj.metadata
    })
  })
  return paymentsArr
}

const processGroupPayment = async (relevantPayments, itemId) => {
  const paymentsArr = buildPaymentsArr(relevantPayments)
  try {
    const body = {
      payments: paymentsArr,
      metadata: { itemId: itemId }
    };
    const result = await makeRequest('POST', '/v1/payments/group_payments', body);
    return result
  } catch (error) {
      return error
  }
  
}

const test = async () => {
  const allPayments = await getAllPayments()
  const relevantPayments = await findRelevantPayments(allPayments, ITEM_ID)
  const fullAmountPaid = calculateAmountPaid(relevantPayments)
  console.log("Item " + ITEM_ID + ": Full price: " + FULL_PRICE + " / Amount paid: " + fullAmountPaid)
}

// test()

app.get("/get-payment-auths", async (req, res) => {
  
  const splitPayID = req.query.splitPayID
  console.log("Getting payment for ID: ", splitPayID)
  const allPayments = await getAllPayments()
  const relevantPayments = await findRelevantPayments(allPayments, splitPayID)
  const amountPaid = calculateAmountPaid(relevantPayments)
  const numSplits = relevantPayments[0].metadata.numberOfSplits

  // console.log(relevantPayments)
  // var returnedPaymentAuths = []
  // relevantPayments.forEach((payment) => {
  //   returnedPaymentAuths.push({
  //     authAmount: payment.original_amount,
  //     name: paymentMethodPersonMap[payment.payment_method]
  //   })
  // })
  return res.json({amountAuthed: amountPaid, numSplits: numSplits})
})

app.post("/create_checkout_page", async (req, res) => {
  const amount = req.body.amountToPay
  const metadata = req.body.metadata

  const bodyForCheckout = {
    country: COUNTRY,
    currency: CURRENCY,
    payment_method_type_categories: ["card"],
    amount: amount,
    capture: false,
    metadata: metadata
  }

  const result = await makeRequest('POST', '/v1/checkout', bodyForCheckout);
  console.log(result.body.data.id)
  return res.json({checkoutID: result.body.data.id})

})

app.post("/made-payment", async (req, res) => {
  console.log("\n\nThe body is: ", req.body)
  // console.log("Yahoo")
  // const paymentAmount = req.body.data.original_amount
  // const fullPrice = parseInt(req.body.data.metadata.fullPrice)
  // const itemId = req.body.data.metadata.itemId
  // console.log("full price and item id: ", fullPrice, itemId)
  // const allPayments = await getAllPayments()
  // const relevantPayments = await findRelevantPayments(allPayments, itemId)
  // console.log("Relevant payments: ", relevantPayments)
  // const fullAmountPaid = calculateAmountPaid(relevantPayments)
  // console.log("Full paid: ", fullAmountPaid)
  // console.log("Full price: ", parseInt(fullPrice))
  // if (fullAmountPaid >= fullPrice) {
  //   console.log("MAKING GRO PPAYMENT")
  //   const groupPayment = await processGroupPayment(relevantPayments, itemId)
  //   console.log("GROU PAYMENT ID: ", groupPayment.body.data.id)
  // }  
  return res.sendStatus(200)
})

app.post("/make_payment", async (req, res) => {
  const personId = req.body.personId
  const paymentAmount = req.body.paymentAmount
  const fullPrice = req.body.fullPrice
  const itemId = req.body.itemId
  // const personId = "C"
  // const paymentAmount = 100
  // const fullPrice = FULL_PRICE
  // const itemId = ITEM_ID
  const capture = false
  const paymentResult = await makePayment(personId, paymentAmount, fullPrice, itemId, capture)
  const allPayments = await getAllPayments()
  const relevantPayments = await findRelevantPayments(allPayments, itemId)
  const fullAmountPaid = calculateAmountPaid(relevantPayments)
  
  var returnedPaymentAuths = []
  relevantPayments.forEach((payment) => {
    returnedPaymentAuths.push({
      authAmount: payment.original_amount,
      name: paymentMethodPersonMap[payment.payment_method]
    })
  })
  var returnObj = {
    paymentAuths: returnedPaymentAuths,
    groupPaymentId: null
  }
  if (fullAmountPaid >= fullPrice) {
    const groupPayment = await processGroupPayment(relevantPayments, itemId)
    returnObj.groupPaymentId = groupPayment.body.data.id
  }
  return res.json(returnObj)

})

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});