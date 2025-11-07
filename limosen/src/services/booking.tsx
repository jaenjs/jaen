// src/services/booking.tsx
import React, { useMemo } from "react"
import { useToast } from "@chakra-ui/react"
import { sendTemplateMail } from "gatsby-jaen-mailpress"
import { useLocation } from "@reach/router"
import { BookingFormValues, BookingModal } from "../components/BookingModal/BookingModal"
import { useAuth } from "jaen"
import { useQueryRouter } from "../hooks/use-query-router"
import { useT } from "../contexts/language"
import { useIntl } from "react-intl"

export interface BookingModalContextProps {
  onOpen: (args?: { meta?: Record<string, any> }) => void
  onClose: () => void
}

export const BookingModalContext =
  React.createContext<BookingModalContextProps>({
    onOpen: () => {},
    onClose: () => {},
  })

export const useBookingModal = () => {
  const context = React.useContext(BookingModalContext)
  if (!context) {
    throw new Error("useBookingModal must be used within a BookingModalProvider")
  }
  return context
}

export interface BookingModalDrawerProps {
  children: React.ReactNode
}

export const BookingModalProvider: React.FC<BookingModalDrawerProps> = ({ children }) => {
  const t = useT()
  const { locale } = useIntl()
  const location = useLocation()
  const { isCalled, paramValue } = useQueryRouter(location, "booking")

  const [meta, setMeta] = React.useState<Record<string, any> | null>(null)
  const [isOpen, setIsOpen] = React.useState(false)

  const toast = useToast()
  const authentication = useAuth()

  const getCurrentUrl = React.useCallback(() => {
    if (typeof window !== "undefined" && window.location) {
      return window.location.href
    }
    const pathname = location?.pathname ?? "/"
    const search = location?.search ?? ""
    const hash = location?.hash ?? ""
    return `${pathname}${search}${hash}`
  }, [location])

  React.useEffect(() => {
    if (isCalled) {
      setMeta(prev => ({ ...prev, url: getCurrentUrl() }))
      setIsOpen(true)
    }
  }, [isCalled, getCurrentUrl])

  const onOpen: BookingModalContextProps["onOpen"] = (args) => {
    const updatedMeta = {
      ...meta,
      url: getCurrentUrl(),
      ...args?.meta,
    }
    setMeta(updatedMeta)
    setIsOpen(true)
  }

  const onClose = () => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.delete("booking")
      window.history.replaceState({}, "", url.toString())
    }
    setIsOpen(false)
  }

  const onSubmit = async (data: BookingFormValues): Promise<void> => {
    const invokedOnUrl = meta?.url ?? getCurrentUrl() ?? "unknown"

    const { errors } = await sendTemplateMail(
      "cc744364-b930-4d3c-918b-d9e98637607b",
      {
        envelope: {
          replyTo: data.email,
        },
        values: {
          // Contact
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || "",
          flightNumber: data.flightNumber || "",
          message: data.message,

          // Ride details
          rideCategory: data.rideCategory || "",
          rideType: data.rideType || "",
          date: data.date || "",
          time: data.time || "",
          pickupAddress: data.pickupAddress || "",
          destinationAddress: data.destinationAddress || "",
          passengers: data.passengers ?? "",
          luggage: data.luggage ?? "",
          childSeats: data.childSeats ?? "",
          extraTime: data.extraTime ?? "",

          // Vehicle & Payment
          carClass: data.carClass || "",
          carTitle: data.carTitle || "",
          paymentOption: data.paymentOption || "",

          // Meta
          locale,          // helpful in your email template
          invokedOnUrl,
        },
      }
    )

    if (errors) {
      toast({
        title: t("ToastErrorTitle", "Error"),
        description: t("ToastErrorDesc", "Something went wrong."),
        status: "error",
        duration: 5000,
        isClosable: true,
      })
    } else {
      toast({
        title: t("ToastSuccessTitle", "Success"),
        description: t("ToastSuccessDesc", "Your reservation request has been sent successfully."),
        status: "success",
        duration: 5000,
        isClosable: true,
      })
      onClose()
    }
  }

  const fixedValues = useMemo(() => {
    if (!authentication.user) {
      return undefined
    }
    return {
      firstName: authentication.user.profile?.given_name,
      lastName: authentication.user.profile?.family_name,
      email: authentication.user.profile?.email,
      phone: authentication.user.profile?.phone_number,
    }
  }, [authentication.user])

  const defaultValues = useMemo(() => {
    if (!isCalled) {
      return undefined
    }
    return {
      message: paramValue,
    }
  }, [isCalled, paramValue])

  return (
    <BookingModalContext.Provider value={{ onOpen, onClose }}>
      {children}
      <BookingModal
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={onSubmit}
        fixedValues={fixedValues}
        defaultValues={defaultValues}
      />
    </BookingModalContext.Provider>
  )
}
