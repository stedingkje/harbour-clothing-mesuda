import { useCheckout } from "@lib/context/checkout-context"
import { PaymentSession } from "@medusajs/medusa"
import Button from "@modules/common/components/button"
import Spinner from "@modules/common/icons/spinner"
import { OnApproveActions, OnApproveData } from "@paypal/paypal-js"
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js"
import {
  IdealBankElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import { useCart } from "medusa-react"
import React, { useEffect, useState } from "react"

type PaymentButtonProps = {
  paymentSession?: PaymentSession | null
}

const PaymentButton: React.FC<PaymentButtonProps> = ({ paymentSession }) => {
  const [notReady, setNotReady] = useState(true)
  const { cart } = useCart()
  const idealBankElement = IdealBankElement
  useEffect(() => {
    setNotReady(true)

    if (!cart) {
      return
    }

    if (!cart.shipping_address) {
      return
    }

    if (!cart.billing_address) {
      return
    }

    if (!cart.email) {
      return
    }

    if (cart.shipping_methods.length < 1) {
      return
    }

    setNotReady(false)
  }, [cart])

  switch (paymentSession?.provider_id) {
    case "stripe":
    case "stripe-ideal":
    case "stripe-bancontact":
    case "stripe-blik":
    case "stripe-giropay":
    case "stripe-przelewy24":
      return (
        <>
          {console.log("STRIPE BUTTON")}
          <StripePaymentButton session={paymentSession} />
        </>
      )
    case "manual":
      return <ManualTestPaymentButton notReady={notReady} />
    case "paypal":
      return (
        <PayPalPaymentButton notReady={notReady} session={paymentSession} />
      )
    default:
      return <Button disabled>Select a payment method</Button>
  }
}

const StripePaymentButton = ({
  session,
  notReady,
}: {
  session: PaymentSession
  notReady?: boolean
}) => {
  const [disabled, setDisabled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  )

  const { cart } = useCart()
  const { onPaymentCompleted } = useCheckout()

  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("cardNumber")

  useEffect(() => {
    if (!stripe || !elements) {
      setDisabled(true)
    } else {
      setDisabled(false)
    }
  }, [stripe, elements])

  const handlePayment = async () => {
    setSubmitting(true)

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false)
      return
    }

    const idealBank = elements.getElement(IdealBankElement)

    // For brevity, this example is using uncontrolled components for
    // the accountholder's name. In a real world app you will
    // probably want to use controlled components.
    // https://reactjs.org/docs/uncontrolled-components.html
    // https://reactjs.org/docs/forms.html#controlled-components

    // const accountholderName = event.target["accountholder-name"]
    console.log("TEST PAYMENT")
    const { error } = await stripe
      .confirmIdealPayment(session.data.client_secret as string, {
        payment_method: {
          ideal: { bank: "rabobank" },
          billing_details: {
            name:
              cart.billing_address.first_name +
              " " +
              cart.billing_address.last_name,
          },
        },
        return_url: "https://example.com/checkout/complete",
      })
      .finally(() => {
        setSubmitting(false)
      })

    if (error) {
      // Show error to your customer.
      console.log(error.message)
    }
    // await stripe
    //   .confirmIdealPayment(session.data.client_secret as string, {
    //     payment_method: {
    //       ideal: { bank: "rabobank" },
    //       billing_details: {
    //         name:
    //           cart.billing_address.first_name +
    //           " " +
    //           cart.billing_address.last_name,
    //         address: {
    //           city: cart.billing_address.city ?? undefined,
    //           country: cart.billing_address.country_code ?? undefined,
    //           line1: cart.billing_address.address_1 ?? undefined,
    //           line2: cart.billing_address.address_2 ?? undefined,
    //           postal_code: cart.billing_address.postal_code ?? undefined,
    //           state: cart.billing_address.province ?? undefined,
    //         },
    //         email: cart.email,
    //         phone: cart.billing_address.phone ?? undefined,
    //       },
    //     },
    //     return_url: "https://google.com",
    //   })
    //   .then(({ error, paymentIntent }) => {
    //     if (error) {
    //       const pi = error.payment_intent

    //       if (
    //         (pi && pi.status === "requires_capture") ||
    //         (pi && pi.status === "succeeded")
    //       ) {
    //         onPaymentCompleted()
    //       }

    //       setErrorMessage(error.message)
    //       return
    //     }

    //     if (
    //       (paymentIntent && paymentIntent.status === "requires_capture") ||
    //       paymentIntent.status === "succeeded"
    //     ) {
    //       return onPaymentCompleted()
    //     }

    //     return
    //   })
    //   .finally(() => {
    //     setSubmitting(false)
    //   })
  }

  return (
    <>
      <Button disabled={submitting} onClick={handlePayment}>
        {submitting ? <Spinner /> : "iDeal betaling doen"}
      </Button>
      {errorMessage && (
        <div className="text-red-500 text-small-regular mt-2">
          {errorMessage}
        </div>
      )}
    </>
  )
}

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ""

const PayPalPaymentButton = ({
  session,
  notReady,
}: {
  session: PaymentSession
  notReady: boolean
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  )

  const { cart } = useCart()
  const { onPaymentCompleted } = useCheckout()

  const handlePayment = async (
    _data: OnApproveData,
    actions: OnApproveActions
  ) => {
    actions?.order
      ?.authorize()
      .then((authorization) => {
        if (authorization.status !== "COMPLETED") {
          setErrorMessage(`An error occurred, status: ${authorization.status}`)
          return
        }
        onPaymentCompleted()
      })
      .catch(() => {
        setErrorMessage(`An unknown error occurred, please try again.`)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }
  return (
    <PayPalScriptProvider
      options={{
        "client-id": PAYPAL_CLIENT_ID,
        currency: cart?.region.currency_code.toUpperCase(),
        intent: "authorize",
      }}
    >
      {errorMessage && (
        <span className="text-rose-500 mt-4">{errorMessage}</span>
      )}
      <PayPalButtons
        style={{ layout: "horizontal" }}
        createOrder={async () => session.data.id as string}
        onApprove={handlePayment}
        disabled={notReady || submitting}
      />
    </PayPalScriptProvider>
  )
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)

  const { onPaymentCompleted } = useCheckout()

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()

    setSubmitting(false)
  }

  return (
    <Button disabled={submitting || notReady} onClick={handlePayment}>
      {submitting ? <Spinner /> : "Checkout"}
    </Button>
  )
}

export default PaymentButton
