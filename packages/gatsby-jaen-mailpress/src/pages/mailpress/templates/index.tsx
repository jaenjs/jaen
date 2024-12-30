import {PageConfig, useNotificationsContext} from 'jaen'
import {
  Button,
  HStack,
  Heading,
  Icon,
  Link,
  Skeleton,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr
} from '@chakra-ui/react'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {Link as GatsbyLink, graphql} from 'gatsby'
import {useEffect} from 'react'
import {resolve, useQuery} from '../../../client/index'
import {EmailSMTPModal} from '../../../EmailSMTPModal'

const SkeletonRow = () => (
  <Tr>
    {[...Array(6)].map((_, index) => (
      <Td key={index}>
        <Skeleton height="6" />
      </Td>
    ))}
  </Tr>
)

const Page: React.FC = () => {
  const {prompt, toast} = useNotificationsContext()

  // const [templates, setTemplates] = useState<MailPressTemplate[]>([])
  // const [isLoading, setIsLoading] = useState(true)

  // useEffect(() => {
  //   // mock data
  //   const load = async () => {
  //     const [data, errors] = await sq.query(q => {
  //       return q.mailpressAllTemplate.map(t => {
  //         return {
  //           id: t.id,
  //           description: t.description,
  //           subject: t.envelope?.subject,
  //           from: t.envelope?.from?.value,
  //           replyTo: t.envelope?.replyTo?.value,
  //           updatedAt: t.updatedAt,
  //           createdAt: t.createdAt
  //         }
  //       })
  //     })

  //     if (errors?.length) {
  //       toast({
  //         title: 'Error',
  //         description: 'Failed to load templates'
  //       })
  //     } else {
  //       setTemplates(data)
  //     }

  //     setIsLoading(false)
  //   }

  //   load()
  // }, [])

  const data = useQuery({})

  useEffect(() => {
    data.$refetch()
  }, [])

  useEffect(() => {
    if (data.$state.error) {
      console.log('error', data.$state.error)
      toast({
        title: `Failed to load templates (${data.$state.error.name})`,
        description: data.$state.error.message,
        status: 'error'
      })
    }
  }, [data.$state.error])

  const handleAddTemplateClick = async () => {
    const description = await prompt({
      title: 'Add Template',
      message: 'Please enter a description for the new template'
    })

    if (description) {
      try {
        await resolve(
          ({mutation}) => {
            const template = mutation.templateCreate({
              input: {
                description: description,
                content: 'Hello!',
                variables: [],
                envelope: {
                  subject: 'Hello!'
                }
              }
            })

            return template.id
          },
          {
            cachePolicy: 'no-store'
          }
        )

        await data.$refetch(true)
      } catch (error) {
        toast({
          title: 'Failed to create template',
          description: error.message,
          status: 'error'
        })
      }
    }
  }

  return (
    <>
      <Stack spacing="4">
        <Heading size="md">Email Templates</Heading>

        <HStack spacing="4" justifyContent="space-between">
          <HStack>
            {data.me.organization.email?.email ? (
              <Text>
                Connected email:{' '}
                <strong>{data.me.organization.email?.email}</strong>
              </Text>
            ) : (
              <Text color="yellow.500">No email connected</Text>
            )}
          </HStack>
          <HStack>
            <EmailSMTPModal
              onSubmit={async input => {
                await resolve(({mutation}) => {
                  return mutation.organizationSetEmail({
                    email: input.email,
                    config: input.config
                  }).id
                })

                await data.$refetch(true)
              }}
            />
            <Button
              leftIcon={<Icon as={FaPlus} />}
              onClick={handleAddTemplateClick}>
              Add Template
            </Button>
          </HStack>
        </HStack>

        <Table>
          <Thead position="sticky" top={0} zIndex={1} borderColor="black">
            <Tr my=".8rem">
              <Th>Description</Th>
              <Th>Subject</Th>
              <Th>To</Th>
              <Th>Reply-To</Th>
              <Th>Updated at</Th>
              <Th>Created at</Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.$state.isLoading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}

            {data.allTemplate().nodes.map(template => {
              return (
                <Tr
                  key={template.id}
                  visibility={data.$state.isLoading ? 'hidden' : 'visible'}>
                  <Td>
                    <Link as={GatsbyLink} to={`./${template.id}`}>
                      {template.description}
                    </Link>
                  </Td>
                  <Td>{template.envelope?.subject}</Td>
                  <Td>{template.envelope?.to}</Td>
                  <Td>{template.envelope?.replyTo}</Td>
                  <Td>{template.updatedAt}</Td>
                  <Td>{template.createdAt}</Td>
                </Tr>
              )
            })}

            {data.allTemplate().totalCount === 0 && (
              <Tr visibility={data.$state.isLoading ? 'hidden' : 'visible'}>
                <Td colSpan={6}>No templates found</Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Stack>
    </>
  )
}

export default Page

export const pageConfig: PageConfig = {
  label: 'Templates',
  icon: 'FaEnvelope',
  menu: {
    type: 'app',
    group: 'mailpress',
    groupLabel: 'Mailpress',
    order: 500
  },
  layout: {
    name: 'jaen'
  },
  breadcrumbs: [
    {
      label: 'Mailpress',
      path: '/mailpress/'
    },
    {
      label: 'Templates',
      path: '/mailpress/templates/'
    }
  ],
  auth: {
    isRequired: true,
    isAdminRequired: true
  }
}

export const query = graphql`
  query ($jaenPageId: String!) {
    ...JaenPageQuery
    allJaenPage {
      nodes {
        ...JaenPageData
        children {
          ...JaenPageData
        }
      }
    }
  }
`

export {Head} from 'jaen'
