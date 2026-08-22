import {PageConfig, useWidgetContext} from 'jaen'
import {
  Accordion,
  Box,
  Heading,
  Stack,
  Table,
  Text,
  StackSeparator
} from '@chakra-ui/react'
import {graphql, PageProps, useStaticQuery} from 'gatsby'
import {useIntl} from 'react-intl'

import {intlText} from '../../lib/intl'

import {JaenWidgetProvider} from '../../contexts/jaen-widget'

const Page: React.FC<PageProps> = () => {
  const intl = useIntl()

  const data = useStaticQuery<{
    allSitePlugin: {
      nodes: {
        id: string
        name: string
        version: string
      }[]
    }
  }>(graphql`
    query AllSitePlugin {
      allSitePlugin {
        nodes {
          id
          name
          version
        }
      }
    }
  `)

  return (
    <Stack gap={6} separator={<StackSeparator />}>
      <Stack gap="6">
        <Heading as="h1" size="lg">
          {intl.formatMessage({
            id: 'CmsDebugVersionInformationHeading',
            defaultMessage: 'Version Information'
          })}
        </Heading>

        <Text fontSize="md">
          {intl.formatMessage({
            id: 'CmsDebugVersionInformationDescription',
            defaultMessage:
              "Below, you'll find information about the versions of Gatsby, Jaen, and plugins installed in your project."
          })}
        </Text>

        <Accordion.Root collapsible multiple>
          {/* Gatsby Information */}
          <Accordion.Item value="item-0">
            <h2>
              <Accordion.ItemTrigger
                _expanded={{
                  fontWeight: 'bold'
                }}>
                <Box as="span" flex="1" textAlign="left">
                  {intl.formatMessage({
                    id: 'CmsDebugGatsbyTitle',
                    defaultMessage: 'Gatsby'
                  })}
                </Box>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
            </h2>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <Stack gap="4">
                  <Text fontSize="md">
                    {intl.formatMessage({
                      id: 'CmsDebugGatsbyDescription',
                      defaultMessage:
                        "Gatsby is a popular static site generator used for building modern web applications. Below, you'll find information about the Gatsby and Gatsby CLI versions installed in your project."
                    })}
                  </Text>
                  <Table.Root variant="line">
                    <Table.Body>
                      <Table.Row>
                        <Table.Cell>
                          {intl.formatMessage({
                            id: 'CmsDebugGatsbyVersionLabel',
                            defaultMessage: 'Gatsby version:'
                          })}
                        </Table.Cell>
                        <Table.Cell>
                          {require('gatsby/package.json').version}
                        </Table.Cell>
                      </Table.Row>
                      <Table.Row>
                        <Table.Cell>
                          {intl.formatMessage({
                            id: 'CmsDebugGatsbyCliVersionLabel',
                            defaultMessage: 'Gatsby CLI version:'
                          })}
                        </Table.Cell>
                        <Table.Cell>
                          {require('gatsby-cli/package.json').version}
                        </Table.Cell>
                      </Table.Row>
                    </Table.Body>
                  </Table.Root>
                </Stack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>

          {/* Jaen Information */}
          <Accordion.Item value="item-1">
            <h2>
              <Accordion.ItemTrigger
                _expanded={{
                  fontWeight: 'bold'
                }}>
                <Box as="span" flex="1" textAlign="left">
                  {intl.formatMessage({
                    id: 'CmsDebugJaenTitle',
                    defaultMessage: 'Jaen'
                  })}
                </Box>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
            </h2>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <Stack gap="4">
                  <Text fontSize="md">
                    {intl.formatMessage({
                      id: 'CmsDebugJaenDescription',
                      defaultMessage:
                        "Jaen is a headless content management system (CMS) for managing your website's content. Below, you'll find information about the Jaen version installed in your project."
                    })}
                  </Text>
                  <Table.Root variant="line">
                    <Table.Body>
                      <Table.Row>
                        <Table.Cell>
                          {intl.formatMessage({
                            id: 'CmsDebugJaenVersionLabel',
                            defaultMessage: 'Jaen version:'
                          })}
                        </Table.Cell>
                        <Table.Cell>
                          {require('jaen/package.json').version}
                        </Table.Cell>
                      </Table.Row>
                    </Table.Body>
                  </Table.Root>
                </Stack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>

          {/* Plugins Information */}
          <Accordion.Item value="item-2">
            <h2>
              <Accordion.ItemTrigger
                _expanded={{
                  fontWeight: 'bold'
                }}>
                <Box as="span" flex="1" textAlign="left">
                  {intl.formatMessage({
                    id: 'CmsDebugPluginsTitle',
                    defaultMessage: 'Plugins'
                  })}
                </Box>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
            </h2>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <Stack gap="4">
                  <Text fontSize="md">
                    {intl.formatMessage({
                      id: 'CmsDebugPluginsDescription',
                      defaultMessage:
                        "Plugins extend the functionality of your website. Below, you'll find a list of installed plugins and their versions."
                    })}
                  </Text>
                  <Table.Root variant="line">
                    <Table.Body>
                      {data.allSitePlugin.nodes.map(node => (
                        <Table.Row key={node.id}>
                          <Table.Cell>{node.name}</Table.Cell>
                          <Table.Cell>{node.version}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Stack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
        </Accordion.Root>
      </Stack>

      <Stack gap="6">
        <Heading as="h1" size="lg">
          {intl.formatMessage({
            id: 'CmsDebugWidgetsHeading',
            defaultMessage: 'Widgets'
          })}
        </Heading>

        <Text fontSize="md">
          {intl.formatMessage({
            id: 'CmsDebugWidgetsDescription',
            defaultMessage:
              "Below, you'll find a list of widgets and their data. This is a preview feature and will be improved in the future."
          })}
        </Text>

        <JaenWidgetProvider>
          <WidgetsTable />
        </JaenWidgetProvider>
      </Stack>
    </Stack>
  )
}

const WidgetsTable: React.FC = () => {
  const intl = useIntl()
  const widgets = useWidgetContext()

  return (
    <Table.Root variant="line">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>
            {intl.formatMessage({
              id: 'CmsDebugWidgetsColumnName',
              defaultMessage: 'Name'
            })}
          </Table.ColumnHeader>
          <Table.ColumnHeader>
            {intl.formatMessage({
              id: 'CmsDebugWidgetsColumnCreatedAt',
              defaultMessage: 'Created At'
            })}
          </Table.ColumnHeader>
          <Table.ColumnHeader>
            {intl.formatMessage({
              id: 'CmsDebugWidgetsColumnModifiedAt',
              defaultMessage: 'Modified At'
            })}
          </Table.ColumnHeader>
          <Table.ColumnHeader>
            {intl.formatMessage({
              id: 'CmsDebugWidgetsColumnData',
              defaultMessage: 'Data'
            })}
          </Table.ColumnHeader>
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {widgets.map(widget => (
          <Table.Row key={widget.id}>
            <Table.Cell>{widget.name}</Table.Cell>
            <Table.Cell>{widget.createdAt}</Table.Cell>
            <Table.Cell>{widget.modifiedAt}</Table.Cell>
            <Table.Cell>
              <pre>{JSON.stringify(widget.data, null, 2)}</pre>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
}

export default Page

export const pageConfig: PageConfig = {
  label: intlText('CmsDebugTitle', 'Jaen CMS | Debug'),

  breadcrumbs: [
    {
      label: intlText('CmsLabelsRoot', 'CMS'),
      path: '/cms/'
    },
    {
      label: intlText('CmsDebugBreadcrumbsDebug', 'Debug'),
      path: '/cms/debug/'
    }
  ],
  auth: {
    isAdminRequired: true
  },
  layout: {
    name: 'jaen'
  }
}
